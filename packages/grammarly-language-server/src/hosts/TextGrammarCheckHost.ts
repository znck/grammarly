import { markRaw, ref } from '@vue/reactivity'
import { EventEmitter } from 'events'
import {
  AlertEvent,
  ChangeSet,
  DocumentContext,
  Emotion,
  getIdRevision,
  GrammarlyAuthContext,
  GrammarlyClient,
  IdAlert,
  IdRevision,
  OutcomeScoresWithPlagiarism,
  ResponseKind,
  ResponseKindType,
  ResponseTypeToResponseMapping,
  SocketError,
  SynonymsGroup,
  TextInfoEvent,
  TextStatsResponse
} from '@emacs-grammarly/unofficial-grammarly-api'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { DevLogger } from '../DevLogger'
import { CheckHostStatus } from './CheckHostStatus'

interface RepositionedAlert extends AlertEvent {
  raw: AlertEvent
}

function parseClientName(name: string): { name: string; type: string } {
  if (name.includes(':')) {
    const parts = name.split(':')

    return { name: parts[0], type: parts[1] }
  }

  return { name, type: 'general' }
}

export class TextGrammarCheckHost {
  private id: string
  private api: GrammarlyClient
  private events = new EventEmitter({ captureRejections: true })
  private auth: GrammarlyAuthContext | null = null
  private LOGGER: DevLogger | null

  private revision: IdRevision = getIdRevision(-1)
  private localText: string = ''
  private remoteText: string = ''

  public alerts = ref(new Map<IdAlert, RepositionedAlert>())
  public user = ref<{ isAnonymous: boolean; isPremium: boolean, username: string }>({ isAnonymous: true, isPremium: false, username: 'anonymous' })

  public score = ref(-1)
  public generalScore = ref(-1)
  public status = ref<CheckHostStatus>('CHECKING')
  public scores = ref<Partial<OutcomeScoresWithPlagiarism>>({})
  public emotions = ref<Emotion[]>([])
  public textInfo = ref<TextInfoEvent | null>(null)

  private disposables: Array<() => void> = []

  public constructor(
    private readonly clientInfo: { name: string; type?: string, version?: string },
    private readonly document: TextDocument,
    public readonly getDocumentContext: () => Promise<DocumentContext>,
    public readonly getTokenInfo: () => Promise<GrammarlyAuthContext>,
    private readonly onError: (error: Error) => void,
  ) {
    this.id = Buffer.from(this.document.uri).toString('hex')
    this.LOGGER = __DEV__ ? new DevLogger(TextGrammarCheckHost.name, this.id.substr(0, 6)) : null
    const { name, type } = parseClientName(this.clientInfo.name ?? '@emacs-grammarly/unofficial-grammarly-language-server')
    this.api = new GrammarlyClient({
      clientName: name,
      clientType: type,
      clientVersion: this.clientInfo.version,
      documentId: this.id,
      getToken: async () => {
        this.auth = await this.getTokenInfo()

        if (this.auth != null) {
          this.user.value = {
            username: this.auth.username,
            isAnonymous: this.auth.isAnonymous,
            isPremium: this.auth.isPremium ?? false,
          }
        }

        return this.auth.token
      },
      onConnection: async () => {
        const context = await this.getDocumentContext()
        await this.api.start({ documentContext: context, dialect: context.dialect })
        await this.api.setOption({
          name: 'gnar_containerId',
          value: this.auth!.container,
        })

        this.setText(this.document.getText())
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
    this.on(ResponseKind.ALERT, (alert) => {
      const changeset = new ChangeSet(this.remoteText, this.localText)
      const newAlert = this.reposition(alert, changeset)
      if (__DEV__) this.LOGGER?.trace(`New alert(${alert.rev}) ${alert.id}: ${alert.highlightBegin} -> ${newAlert.highlightBegin}`)
      this.alerts.value.set(alert.id, markRaw({ ...newAlert, raw: alert }))
    })
    this.on(ResponseKind.REMOVE, (alert) => this.alerts.value.delete(alert.id))
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
    return this.auth || { username: 'anonymous', isAnonymous: true, container: '' }
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

  public onDispose(fn: () => void) {
    this.disposables.push(fn)
  }

  public dispose() {
    this.disposables.forEach((dispose) => {
      try {
        dispose()
      } catch { }
    })
    this.api.dispose()
    this.events.removeAllListeners()
  }

  public setText(text: string): void {
    this.repositionAlerts(new ChangeSet(this.localText, text))
    this.localText = text
    void this.sync()
  }

  private repositionAlerts(changeset: ChangeSet): void {
    const newAlerts = new Map<IdAlert, RepositionedAlert>()
    if (__DEV__) this.LOGGER?.debug('ChangeSet', changeset.diff())
    this.alerts.value.forEach((alert) => {
      const newAlert = this.reposition(alert, changeset)
      if (newAlert.highlightBegin !== alert.highlightBegin) {
        if (__DEV__) this.LOGGER?.trace(`Repositioned(${alert.rev}) ${newAlert.id}: ${alert.highlightBegin} -> ${newAlert.highlightBegin}, ${alert.highlightEnd} -> ${newAlert.highlightEnd}`)
      }

      newAlerts.set(newAlert.id, markRaw({ ...newAlert, raw: alert.raw }))
    })

    this.alerts.value = newAlerts
  }

  private reposition(alert: AlertEvent, changeset: ChangeSet): AlertEvent {
    if (alert.highlightBegin != null) {
      const highlightLen = alert.highlightEnd - alert.highlightBegin
      alert.highlightBegin = changeset.reposition(alert.highlightBegin)
      alert.highlightEnd = alert.highlightBegin + highlightLen
    }

    if (alert.begin != null) {
      const len = alert.end - alert.begin
      alert.begin = changeset.reposition(alert.begin)
      alert.end = alert.begin + len
    }

    alert.subalerts?.forEach(subalert => {
      if (subalert.transformJson.context.s != null) {
        const len = subalert.transformJson.context.e - subalert.transformJson.context.s
        subalert.transformJson.context.s = changeset.reposition(subalert.transformJson.context.s)
        subalert.transformJson.context.e = subalert.transformJson.context.s + len
      }
    })

    return alert
  }

  private isSyncing: boolean = false
  private async sync(): Promise<void> {
    if (this.isSyncing) {
      this.LOGGER?.trace('[sync] another sync request in progress, skipping...')
      return
    }
    if (this.remoteText === this.localText) {
      this.LOGGER?.trace(`[sync] No text change, skipping...`)
      return
    }

    this.isSyncing = true
    const remoteText = this.remoteText
    const localText = this.localText
    const changeset = new ChangeSet(remoteText, localText)
    const deltas = changeset.diff()
    const rev = getIdRevision(this.revision + 1)

    this.remoteText = localText
    this.revision = rev

    await this.api.submitOT({ rev, doc_len: remoteText.length, deltas, chunked: false })

    this.isSyncing = false

    this.LOGGER?.debug(`[sync] Remote Text: ${rev}`)

    void this.sync()
  }

  public async getSynonyms(offset: number, word: string): Promise<SynonymsGroup[]> {
    const result = await this.api.getSynonyms({ begin: offset, token: word })

    return result.synonyms.meanings
  }

  public async getTextStats(): Promise<TextStatsResponse> {
    return this.api.getTextStats({})
  }

  public getAlert(id: IdAlert): RepositionedAlert | undefined {
    return this.alerts.value.get(id)
  }

  public async addToDictionary(alertId: IdAlert): Promise<void> {
    await this.api.sendFeedbackForAlert({ type: 'ADD_TO_DICTIONARY', alertId })
  }

  public async dismissAlert(alertId: IdAlert): Promise<void> {
    this.alerts.value.delete(alertId)
    await this.api.sendFeedbackForAlert({ type: 'IGNORE', alertId })
  }

  public async acceptAlert(alertId: IdAlert, text?: string): Promise<void> {
    this.alerts.value.delete(alertId)
    await this.api.sendFeedbackForAlert({ type: 'ACCEPTED', text, alertId })
  }

  public async setDocumentContext(documentContext: DocumentContext): Promise<void> {
    await this.api.setContext({ rev: this.revision, documentContext })
  }
}
