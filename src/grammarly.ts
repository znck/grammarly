import WebSocket from 'ws'
import { AuthParams, connect, Connection } from './socket'
import { EventEmitter } from 'events'
import { TextDocument } from 'vscode-languageclient'
import { AuthCookie } from './grammarly-auth'
import createLogger from 'debug'
import { getConfigurationFor, ExtensionConfiguration } from './configuration'

const debug = createLogger('grammarly:host')

export namespace Grammarly {
  export enum Action {
    ALERT = 'alert',
    CONTEXT = 'context',
    ERROR = 'error',
    FEEDBACK = 'feedback',
    FINISHED = 'finished',
    OPTION = 'option',
    PING = 'ping',
    REMOVE = 'remove',
    START = 'start',
    OPERATION_TRANSFORM = 'submit_ot',
    SYNONYMS = 'synonyms',
  }

  export enum Feature {
    ALERTS_CHANGES = 'alerts_changes',
    ALERTS_UPDATE = 'alerts_update',
    CONSISTENCY_CHECK = 'consistency_check',
    FILLER_WORDS_CHECK = 'filler_words_check',
    FREE_CLARITY_ALERTS = 'free_clarity_alerts',
    FREE_INLINE_ADVANCED_ALERTS = 'free_inline_advanced_alerts',
    HIDDEN_ALERTS_UPDATE = 'hidden_alerts_update',
    READABILITY_CHECK = 'readability_check',
    SENTENCE_VARIETY_CHECK = 'sentence_variety_check',
    SET_GOALS_LINK = 'set_goals_link',
    SUPER_ALERTS = 'super_alerts',
    TEXT_INFO = 'text_info',
  }

  export interface Message {
    action: Action
  }

  export interface Response extends Message {
    id: number
  }

  export interface StartMessage extends Message {
    action: Action.START
    client: 'denali_editor'
    clientSubType: 'general'
    clientSupports: Feature[]
    clientVersion: '1.5.43-2114+master'
    dialect: Dialect
    docid: string
    documentContext: DocumentContext
  }

  export interface StartResponse extends Response {
    action: Action.START
    sid: number
  }

  export namespace OT {
    export interface Init {
      0: {
        insert: string
      }
    }

    export interface Insert {
      0: {
        retain: number
      }
      1: {
        insert: string
      }
    }

    export interface Delete {
      0: {
        retain: number
      }
      1: {
        delete: number
      }
    }

    export type Operation = Init | Insert | Delete
  }

  export interface OperationalTransformMessage extends Message {
    action: Action.OPERATION_TRANSFORM
    doc_len: number
    rev: number
    deltas: Array<{ ops: OT.Operation }>
  }

  export interface OperationTransformResponse extends Response {
    action: Action.OPERATION_TRANSFORM
    rev: number
  }

  export interface SynonymsMessage extends Message {
    action: Action.SYNONYMS
    begin: number
    token: string
  }

  export interface Alert {
    id: number

    begin: number
    end: number
    text: string

    point: string
    group: string
    category: string
    categoryHuman: string

    title: string
    todo: string
    details: string
    examples: string
    explanation: string

    highlightBegin: number
    highlightEnd: number
    highlightText: string

    replacements: string[]

    impact: string

    sentence_no: number
  }

  export interface AlertResponse extends Alert, Response {
    action: Action.ALERT
    rev: number
    pid: number
    rid: number
    sid: number
  }

  export interface RemoveAlertResponse extends Response {
    action: Action.REMOVE
    id: number
  }

  export interface FinishedResponse extends Response {
    action: Action.FINISHED
    dialect: Dialect
    foreign: boolean
    generalScore: number
    outcomeScores: {
      Clarity: number
      Correctness: number
      Engagement: number
      GeneralScore: number
      Tone: number
    }
    removed: number[]
    rev: number
    score: number
    sid: number
  }

  export interface TokenMeaning {
    meaning: string
    synonyms: Array<{ base: string; derived: string }>
  }

  export interface SynonymsResponse extends Response {
    action: Action.SYNONYMS
    token: string
    synonyms: {
      correlationId: number
      meanings: TokenMeaning[]
      pos: string
      token: string
    }
  }

  export interface OptionMessage extends Message {
    action: Action.OPTION
    name: string
    value: string | number | boolean
  }

  export interface OptionResponse extends Response {
    action: Action.OPTION
  }

  export interface PingMessage extends Message {
    action: Action.PING
  }

  export interface PingResponse extends Response {
    action: Action.PING
  }

  export interface ContextMessage extends Message {
    action: Action.CONTEXT
    rev: number
    documentContext: DocumentContext
  }

  export interface ContextResponse extends Response {
    action: Action.CONTEXT
    rev: number
  }

  enum Severity {
    INFO = 'info',
  }
  export interface ErrorResponse extends Response {
    error: string
    severity: Severity
    action: Action.ERROR
  }

  export enum DocumentAudience {
    GENERAL = 'general',
    KNOWLEDGEABLE = 'knowledgeable',
    EXPERT = 'expert',
  }

  export enum Dialect {
    AMERICAN = 'american',
    BRITISH = 'british',
  }

  export enum DocumentDomain {
    ACADEMIC = 'academic',
    BUSINESS = 'business',
    GENERAL = 'general',
    TECHNICAL = 'technical',
    CASUAL = 'casual',
    CREATIVE = 'creative',
  }

  export enum DocumentGoal {
    TELL_A_STORY = 'tellStory',
    CONVINCE = 'convince',
    DESCRIBE = 'describe',
    INFORM = 'inform',
  }

  export enum WritingTone {
    MILD = 'mild',
  }

  export enum WritingStyle {
    INFORMAL = 'informal',
    NEUTRAL = 'neutral',
    FORMAL = 'formal',
  }

  export enum WritingEmotion {
    NEUTRAL = 'neutral',
    CONFIDENT = 'confident',
    JOYFUL = 'joyful',
    OPTIMISTIC = 'optimistic',
    RESPECTFUL = 'respectful',
    URGENT = 'urgent',
    FRIENDLY = 'friendly',
    ANALYTICAL = 'analytical',
  }

  export interface DocumentContext {
    audience: DocumentAudience
    dialect: Dialect
    domain: DocumentDomain
    emotion: WritingTone
    emotions: WritingEmotion[]
    goals: DocumentGoal[]
    style: WritingStyle
  }

  export interface ResponseTypes {
    [Action.ALERT]: AlertResponse
    [Action.CONTEXT]: ContextResponse
    [Action.ERROR]: ErrorResponse
    [Action.FINISHED]: FinishedResponse
    [Action.OPTION]: OptionResponse
    [Action.PING]: PingResponse
    [Action.REMOVE]: RemoveAlertResponse
    [Action.START]: StartResponse
    [Action.OPERATION_TRANSFORM]: OperationTransformResponse
    [Action.SYNONYMS]: SynonymsResponse
  }

  function isResponseType(response: Response, kind: keyof ResponseTypes): response is ResponseTypes[typeof kind] {
    return response.action === kind
  }

  export function getDefaultDocumentContext(config: ExtensionConfiguration): DocumentContext {
    // TODO: Should use configuration here.
    return {
      audience: DocumentAudience.KNOWLEDGEABLE,
      dialect: config.dialect,
      domain: DocumentDomain.GENERAL,
      emotion: WritingTone.MILD,
      emotions: [],
      goals: [],
      style: WritingStyle.NEUTRAL,
    }
  }

  export class DocumentHost extends EventEmitter {
    private currentMessageId = -1
    private currentRevision = -1
    private socket: WebSocket | null = null
    private cookie: AuthCookie | undefined
    private queue: Message[] = []
    private _status: 'active' | 'inactive' | 'broken' = 'inactive'
    private intervalHandle: null | NodeJS.Timeout = null

    constructor(private document: TextDocument, private authParams?: AuthParams) {
      super()
      
      this.on(Action.ERROR, error => {
        console.error('Grammarly connection terminated due to error:', error)
        this._status = 'inactive'
        if (this.intervalHandle) clearInterval(this.intervalHandle)
        this.queue.length = 0
        this.socket!.close()
        this.refresh()
      })

      this.refresh()
    }

    get status() {
      return this._status
    }

    private handleConnection(connection: Connection) {
      this.socket = connection.socket
      this.cookie = connection.cookie

      this.socket!.onmessage = event => this.onResponse(JSON.parse(event.data.toString()))
      
      this.sendStartMessage()
      this.insert(0, this.document.getText())
      this.set('gnar_containerId', this.cookie!.gnar_containerId)
    }

    refresh() {
      debug({ type: 'INIT', documentId: this.document.uri })
      connect(this.authParams, this.cookie).then(connection => this.handleConnection(connection))
    }

    dispose() {
      if (this.socket) {
        delete this.socket.onmessage

        this.socket.close()
        delete this.socket
      }

      if (this.intervalHandle) clearInterval(this.intervalHandle)
    }

    private onResponse(response: Response) {
      debug({ type: 'RECV', response })

      if (this.status === 'inactive') {
        if (isResponseType(response, Action.START)) {
          this._status = 'active'
          const messages = this.queue.slice()
          this.queue.length = 0
          messages.forEach(message => this.send(message))
          this.intervalHandle = setInterval(() => this.send({ action: Action.PING }), 10000)
        } else {
          this._status = 'broken'
        }
      }

      this.emit(response.action, response)
    }

    on<K extends keyof ResponseTypes>(event: K, fn: (response: ResponseTypes[K]) => void): this {
      return super.on(event, fn)
    }

    private sendStartMessage() {
      const start: StartMessage = {
        action: Action.START,
        client: 'denali_editor',
        clientSubType: 'general',
        clientSupports: [
          Feature.TEXT_INFO,
          Feature.FREE_INLINE_ADVANCED_ALERTS,
          Feature.READABILITY_CHECK,
          Feature.SENTENCE_VARIETY_CHECK,
          Feature.FILLER_WORDS_CHECK,
          Feature.ALERTS_UPDATE,
          Feature.ALERTS_CHANGES,
          Feature.FREE_CLARITY_ALERTS,
          Feature.SUPER_ALERTS,
          Feature.CONSISTENCY_CHECK,
          Feature.HIDDEN_ALERTS_UPDATE,
          Feature.SET_GOALS_LINK,
        ],
        clientVersion: '1.5.43-2114+master',
        dialect: Dialect.AMERICAN,
        documentContext: getDefaultDocumentContext(getConfigurationFor(this.document.uri)),
        docid: Buffer.from(this.document.uri).toString('base64'),
      }

      this.send(start)
    }

    insert(documentLength: number, content: string, offsetStart?: number) {
      const ot: OperationalTransformMessage = {
        action: Action.OPERATION_TRANSFORM,
        doc_len: documentLength,
        rev: ++this.currentRevision,
        deltas: [
          {
            ops:
              typeof offsetStart === 'number' ? [{ retain: offsetStart }, { insert: content }] : [{ insert: content }],
          },
        ],
      }

      this.send(ot)
    }

    delete(documentLength: number, deleteLength: number, offsetStart: number) {
      const ot: OperationalTransformMessage = {
        action: Action.OPERATION_TRANSFORM,
        doc_len: documentLength,
        rev: ++this.currentRevision,
        deltas: [
          {
            ops: [{ retain: offsetStart }, { delete: deleteLength }],
          },
        ],
      }

      this.send(ot)
    }

    synonyms(offsetStart: number, word: string) {
      const message: SynonymsMessage = {
        action: Action.SYNONYMS,
        begin: offsetStart,
        token: word,
      }

      this.send(message)

      return new Promise(() => {})
    }

    setContext(context: DocumentContext) {
      const message: ContextMessage = {
        action: Action.CONTEXT,
        documentContext: context,
        rev: this.currentRevision,
      }

      this.send(message)
    }

    set(key: string, value: string | number | boolean) {
      const option: OptionMessage = {
        action: Action.OPTION,
        name: key,
        value: value,
      }

      this.send(option)
    }

    private send(message: Message) {
      const payload: any = {
        ...message,
      }

      if (!('id' in payload)) {
        payload.id = ++this.currentMessageId
      }

      if (this.socket && (this.status === 'active' || message.action === Action.START)) {
        debug({
          type: 'SEND',
          payload,
        })
        this.socket.send(JSON.stringify(payload))
      } else this.queue.push(payload)
    }
  }
}
