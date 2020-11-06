import { ref } from '@vue/reactivity'
import { EventEmitter } from 'events'
import {
  AlertEvent,
  ChangeSet,
  DocumentContext,
  Emotion,
  GrammarlyAuthContext,
  GrammarlyClient,
  IdAlert,
  IdRevision,
  OutcomeScoresWithPlagiarism,
  ResponseKind,
  ResponseKindType,
  ResponseTypeToResponseMapping,
  SocketError,
  TextChange,
  TextInfoEvent,
} from 'unofficial-grammarly-api'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { DevLogger } from '../DevLogger'
import { CheckHostStatus } from './CheckHostStatus'

export class TextGrammarCheckHost {
  private id: string
  private api: GrammarlyClient
  private offsetVersion: number = 0
  private events = new EventEmitter({ captureRejections: true })
  private auth: GrammarlyAuthContext | null = null
  private LOGGER: DevLogger | null
  private remoteRevision!: IdRevision

  public alerts = ref(new Map<IdAlert, AlertEvent>())
  public user = ref<{ isAnonymous: boolean; isPremium: boolean }>({ isAnonymous: true, isPremium: false })

  public score = ref(-1)
  public generalScore = ref(-1)
  public status = ref<CheckHostStatus>('CHECKING')
  public scores = ref<Partial<OutcomeScoresWithPlagiarism>>({})
  public emotions = ref<Emotion[]>([])
  public textInfo = ref<TextInfoEvent | null>(null)

  private disposables: Array<() => void> = []

  public constructor(
    private readonly document: TextDocument,
    public readonly getDocumentContext: () => Promise<DocumentContext>,
    public readonly getTokenInfo: () => Promise<GrammarlyAuthContext>,
    private readonly onError: (error: Error) => void,
  ) {
    this.id = Buffer.from(this.document.uri).toString('hex')
    this.LOGGER = __DEV__ ? new DevLogger(TextGrammarCheckHost.name, this.id) : null
    this.api = new GrammarlyClient({
      clientName: 'unofficial-grammarly-language-server',
      clientType: 'general',
      documentId: this.id,
      getToken: async () => {
        this.auth = await this.getTokenInfo()

        return this.auth.token
      },
      onConnection: async () => {
        const context = await this.getDocumentContext()
        this.offsetVersion = this.document.version
        await this.api.start({ documentContext: context, dialect: context.dialect })
        await this.api.setOption({
          name: 'gnar_containerId',
          value: this.auth!.container,
        })
        await this.edit(0).setText(this.document.getText()).apply()
      },
      onMessage: (message) => this.events.emit(message.action, message),
      onError: (error) => {
        this.onError(error)

        if (error instanceof SocketError) {
          if (error.code === 4000) {
            this.api.ping()
          }
        }
      },
    })

    if (__DEV__) this.LOGGER?.debug(`Hosting ${document.uri}`)
    this.on(ResponseKind.ALERT, (alert) => this.alerts.value.set(alert.id, alert))
    this.on(ResponseKind.REMOVE, (alert) => this.alerts.value.delete(alert.id))
    this.on(ResponseKind.SUBMIT_OT, (message) => {
      this.remoteRevision = message.rev
      if (__DEV__)
        this.LOGGER?.trace(
          `Local: ${this.getLocalRevision()}, Remote: ${this.remoteRevision}, Version: ${this.document.version}`,
        )
    })
    this.on(ResponseKind.EMOTIONS, (message) => {
      this.emotions.value = message.emotions
    })
    this.on(ResponseKind.FINISHED, (message) => {
      this.status.value = 'IDLE'
      if (message.outcomeScores) {
        this.scores.value = message.outcomeScores
      }
      this.score.value = message.score
      if (message.generalScore) {
        this.generalScore.value = message.generalScore
      }
    })
    this.on(ResponseKind.TEXT_INFO, (message) => {
      this.textInfo.value = message
    })
    this.on(ResponseKind.TEXT_INFO, (message) => {
      this.textInfo.value = message
    })
  }

  public get context(): Omit<GrammarlyAuthContext, 'token'> {
    return this.auth || { username: 'anonymous', isAnonymous: true, container: '' } // TODO: Get user info from API.
  }

  public on<T extends ResponseKindType>(action: T, callback: (message: ResponseTypeToResponseMapping[T]) => void) {
    this.events.on(action, callback)
    return () => this.off(action, callback)
  }

  public off<T extends ResponseKindType>(action: T, callback: (message: ResponseTypeToResponseMapping[T]) => void) {
    this.events.off(action, callback)
  }

  public once<T extends ResponseKindType>(action: T, callback: (message: ResponseTypeToResponseMapping[T]) => void) {
    this.events.once(action, callback)
  }

  public onTextChange(callback: (event: { rev: IdRevision; changes: TextChange[] }) => void) {
    this.events.on('change', callback)

    return () => this.events.off('change', callback)
  }

  private getLocalRevision(version = this.document.version): IdRevision {
    return (version - this.offsetVersion) as IdRevision
  }

  public onDispose(fn: () => void) {
    this.disposables.push(fn)
  }

  public dispose() {
    this.disposables.forEach((dispose) => {
      try {
        dispose()
      } catch {}
    })
    this.api.dispose()
    this.events.removeAllListeners()
  }

  public edit(doc_len = this.document.getText().length, nextVersion?: number): ChangeSet {
    const rev = this.getLocalRevision(nextVersion)

    return new ChangeSet(async (deltas, changes) => {
      if (__DEV__)
        this.LOGGER?.trace(`Local: ${rev}, Remote: ${this.remoteRevision}, Version: ${this.document.version}`)
      this.events.emit('change', { rev, changes })
      this.status.value = 'CHECKING'
      await this.api.submitOT({ rev, doc_len, deltas, chunked: false })
    })
  }

  public async getSynonyms(offset: number, word: string) {
    const result = await this.api.getSynonyms({ begin: offset, token: word })

    return result.synonyms
  }

  public async getTextStats() {
    return this.api.getTextStats({})
  }

  public getAlert(id: IdAlert) {
    return this.alerts.value.get(id)
  }

  public async addToDictionary(_: IdAlert) {
    // TODO
  }

  public async dismissAlert(_: IdAlert) {
    // TODO
  }

  public async acceptAlert(alertId: IdAlert, text?: string) {
    this.api.sendFeedbackForAlert({ type: 'ACCEPTED', text, alertId })
  }

  public async setDocumentContext(documentContext: DocumentContext) {
    await this.api.setContext({ rev: 1 as IdRevision, documentContext })
  }
}
