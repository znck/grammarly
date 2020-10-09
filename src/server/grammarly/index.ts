import { GrammarlySettings } from '@/settings';
import createLogger from 'debug';
import { EventEmitter } from 'events';
import minimatch from 'minimatch';
import { TextDocument } from 'vscode-languageserver-textdocument';
import WebSocket from 'ws';
import { AuthParams, connect, Connection } from '@/server/socket';
import { AuthCookie } from './auth';
import debounce from 'lodash.debounce';
import { toArray } from '@/utils/toArray';

process.env.DEBUG = 'grammarly:*';

const debug = createLogger('grammarly:host');

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
    STATS = 'get_text_stats',
  }

  export enum ResponseAction {
    EMOTIONS = 'emotions',
    TEXT_INFO = 'text_info',
    STATS = 'text_stats',
    PONG = 'pong',
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
    TONE_CARDS = 'tone_cards',
    VOX_CHECK = 'vox_check',
  }

  export interface Message extends IMessage<Action> {}

  export interface IMessage<T> {
    action: T;
  }

  export interface Response extends IMessage<Action | ResponseAction> {
    id: number;
  }

  export interface StartMessage extends Message {
    action: Action.START;
    client: 'denali_editor';
    clientSubType: 'general';
    clientSupports: Feature[];
    clientVersion: '1.5.43-2114+master';
    dialect: Dialect;
    docid: string;
    documentContext: DocumentContext;
  }

  export interface StartResponse extends Response {
    action: Action.START;
    sid: number;
  }

  export namespace OT {
    export interface Init {
      0: {
        insert: string;
      };
    }

    export interface Insert {
      0: {
        retain: number;
      };
      1: {
        insert: string;
      };
    }

    export interface Delete {
      0: {
        retain: number;
      };
      1: {
        delete: number;
      };
    }

    export type Operation = Init | Insert | Delete;
  }

  export interface OperationalTransformMessage extends Message {
    action: Action.OPERATION_TRANSFORM;
    doc_len: number;
    rev: number;
    deltas: Array<{ ops: OT.Operation }>;
  }

  export interface OperationTransformResponse extends Response {
    action: Action.OPERATION_TRANSFORM;
    rev: number;
  }

  export interface SynonymsMessage extends Message {
    action: Action.SYNONYMS;
    begin: number;
    token: string;
  }

  export interface AddToDictionaryMessage extends Message {
    action: Action.FEEDBACK;
    type: 'ADD_TO_DICTIONARY';
    alertId: string;
  }

  export interface IgnoreMessage extends Message {
    action: Action.FEEDBACK;
    type: 'IGNORE';
    alertId: string;
  }

  export interface AcceptedMessage extends Message {
    action: Action.FEEDBACK;
    type: 'ACCEPTED';
    alertId: string;
    text: string;
  }

  export interface IncorrectSuggestionMessage extends Message {
    action: Action.FEEDBACK;
    type: 'WRONG_SUGGESTION';
    alertId: string;
  }

  export interface OffensiveContentMessage extends Message {
    action: Action.FEEDBACK;
    type: 'OFFENSIVE_CONTENT';
    alertId: string;
  }

  export interface Alert {
    id: number;

    begin: number;
    end: number;
    text: string;

    point: string;
    group: string;
    category: string;
    categoryHuman: string;

    title: string;
    todo: string;
    details: string;
    examples: string;
    explanation: string;

    highlightBegin: number;
    highlightEnd: number;
    highlightText: string;

    replacements: string[];

    impact: string;

    sentence_no: number;
    hidden: boolean;
  }

  export interface AlertResponse extends Alert, Response {
    action: Action.ALERT;
    rev: number;
    pid: number;
    rid: number;
    sid: number;
  }

  export interface RemoveAlertResponse extends Response {
    action: Action.REMOVE;
    id: number;
  }

  export interface FinishedResponse extends Response {
    action: Action.FINISHED;
    dialect: Dialect;
    foreign: boolean;
    generalScore: number;
    outcomeScores: {
      Clarity: number;
      Correctness: number;
      Engagement: number;
      GeneralScore: number;
      Tone: number;
    };
    removed: number[];
    rev: number;
    score: number;
    sid: number;
  }

  export interface FeedbackResponse extends Response {
    scores: {
      Clarity: number;
      Correctness: number;
      Engagement: number;
      GeneralScore: number;
      Tone: number;
    };
  }

  export interface StatsResponse extends Response {
    action: ResponseAction.STATS;
    chars: number;
    words: number;
    sentences: number;
    uniqueWords: number;
    uniqueWordsIndex: number;
    rareWords: number;
    rareWordsIndex: number;
    wordLength: number;
    wordLengthIndex: number;
    sentenceLength: number;
    sentenceLengthIndex: number;
    readabilityScore: number;
    readabilityDescription: string;
    emotionScore: {
      sentiment: string;
      intensity: string;
    };
  }

  export interface TokenMeaning {
    meaning: string;
    synonyms: Array<{ base: string; derived: string }>;
  }

  export interface SynonymsResponse extends Response {
    action: Action.SYNONYMS;
    token: string;
    synonyms: {
      correlationId: number;
      meanings: TokenMeaning[];
      pos: string;
      token: string;
    };
  }

  export interface OptionMessage extends Message {
    action: Action.OPTION;
    name: string;
    value: string | number | boolean;
  }

  export interface OptionResponse extends Response {
    action: Action.OPTION;
  }

  export interface PingMessage extends Message {
    action: Action.PING;
  }

  export interface PingResponse extends Response {
    action: Action.PING;
  }

  export interface ContextMessage extends Message {
    action: Action.CONTEXT;
    rev: number;
    documentContext: DocumentContext;
  }

  export interface ContextResponse extends Response {
    action: Action.CONTEXT;
    rev: number;
  }

  enum Severity {
    INFO = 'info',
  }
  export interface ErrorResponse extends Response {
    error: string;
    severity: Severity;
    action: Action.ERROR;
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
    audience: DocumentAudience;
    dialect: Dialect;
    domain: DocumentDomain;
    emotion: WritingTone;
    emotions: WritingEmotion[];
    goals: DocumentGoal[];
    style: WritingStyle;
  }

  export interface ResponseTypes {
    [Action.ALERT]: AlertResponse;
    [Action.CONTEXT]: ContextResponse;
    [Action.ERROR]: ErrorResponse;
    [Action.FINISHED]: FinishedResponse;
    [Action.OPTION]: OptionResponse;
    [Action.PING]: PingResponse;
    [Action.REMOVE]: RemoveAlertResponse;
    [Action.START]: StartResponse;
    [Action.OPERATION_TRANSFORM]: OperationTransformResponse;
    [Action.SYNONYMS]: SynonymsResponse;
    [Action.FEEDBACK]: FeedbackResponse;
    [Action.STATS]: StatsResponse;
    [ResponseAction.EMOTIONS]: Response;
    [ResponseAction.TEXT_INFO]: Response;
  }

  export interface EmotionsResponse {
    action: ResponseAction.EMOTIONS;
    hidden: boolean;
    emotions: Array<{
      emoji: string;
      name: string;
      confidence: string;
    }>;
  }

  export interface TextInfoResponse extends Response {
    action: ResponseAction.TEXT_INFO;
    wordsCount: number;
    charsCount: number;
    readabilityScore: number;
  }

  function isResponseType(response: Response, kind: keyof ResponseTypes): response is ResponseTypes[typeof kind] {
    return response.action === kind;
  }

  export function getDocumentContext(document: TextDocument, config: GrammarlySettings): DocumentContext {
    const uri = document.uri;
    const override = config.overrides.find((override) =>
      toArray(override.files).some((pattern) => uri.endsWith(pattern) || minimatch(uri, pattern))
    );

    const context = {
      audience: config.audience,
      dialect: config.dialect,
      domain: config.domain,
      emotion: config.emotion,
      emotions: config.emotions,
      goals: config.goals,
      style: config.style,
    };

    if (override) {
      const { config } = override;

      if (config.audience) context.audience = config.audience;
      if (config.dialect) context.dialect = config.dialect;
      if (config.domain) context.domain = config.domain;
      if (config.emotion) context.emotion = config.emotion;
      if (config.emotions) context.emotions = config.emotions;
      if (config.goals) context.goals = config.goals;
      if (config.style) context.style = config.style;
    }

    return context;
  }

  export class DocumentHost extends EventEmitter {
    private currentMessageId = -1;
    private currentRevision = -1;
    private socket: WebSocket | null = null;
    private queue: Message[] = [];
    private _status: 'active' | 'inactive' | 'broken' = 'inactive';
    private _isAuthenticated = false;
    private intervalHandle: null | NodeJS.Timeout = null;

    constructor(
      private readonly document: TextDocument,
      public settings: DocumentContext,
      public authParams?: AuthParams,
      public cookie?: AuthCookie
    ) {
      super();

      this.on(Action.ERROR, (error) => {
        if (error.error === 'cannot_find_synonym') return;

        console.error('Grammarly connection terminated due to error:', error); // TODO: Show error.
        this._status = 'inactive';
        if (this.intervalHandle) clearInterval(this.intervalHandle);
        this.queue.length = 0;
        this.socket!.close();
        this.refresh();
      });

      this.refresh();
    }

    public get isAuthenticated() {
      return this._isAuthenticated;
    }

    public get status() {
      return this._status;
    }

    private async handleConnection(connection: Connection) {
      this.socket = connection.socket;
      // @ts-ignore - readonly for external
      this.cookie = connection.cookie;

      if (this.authParams?.username) {
        this._isAuthenticated = true;
      } else {
        this._isAuthenticated = false;
      }

      this.emit('$/ready');

      this.socket!.onmessage = (event) => this.onResponse(JSON.parse(event.data.toString()));
      // this.socket.onerror // TODO: Handle socket errors.
      this.queue.length = 0;
      this.ots.length = 0;
      this.pendingResponses = 0;
      this.currentMessageId = 0;

      await this.sendStartMessage();
      this.insert(0, this.document.getText());
      this.set('gnar_containerId', this.cookie!.gnar_containerId);
    }

    refresh() {
      debug({
        type: 'INIT',
        documentId: this.document.uri,
        account: !!this.authParams ? 'private' : 'public',
      });
      this.emit('$/connect');
      connect(this.authParams, this.cookie)
        .then((connection) => this.handleConnection(connection))
        .catch((error) => this.emit('$/error', error));
    }

    dispose() {
      if (this.socket) {
        delete this.socket.onmessage;

        this.socket.close();
        delete this.socket;
      }

      if (this.intervalHandle) clearInterval(this.intervalHandle);
    }

    on(event: string, fn: (...args: any[]) => any): this;
    on<K extends keyof ResponseTypes>(event: K, fn: (response: ResponseTypes[K]) => void): this {
      return super.on(event, fn);
    }

    once(event: string, fn: () => any): this;
    once<K extends keyof ResponseTypes>(event: K, fn: (response: ResponseTypes[K]) => void): this {
      return super.once(event, fn);
    }

    private async sendStartMessage() {
      const documentContext = this.settings;

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
        dialect: documentContext.dialect,
        documentContext: documentContext,
        docid: Buffer.from(this.document.uri).toString('base64'),
      };

      this.send(start);
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
      };

      if (typeof offsetStart === 'number') {
        this.sendDebounced(ot);
      } else {
        this.flushOTs();
        this.send(ot);
      }
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
      };

      this.sendDebounced(ot);
    }

    synonyms(offsetStart: number, word: string) {
      const message: SynonymsMessage = {
        action: Action.SYNONYMS,
        begin: offsetStart,
        token: word,
      };

      return this.sendAndWaitForResponse(message);
    }

    addToDictionary(alertId: number) {
      const message: AddToDictionaryMessage = {
        action: Action.FEEDBACK,
        type: 'ADD_TO_DICTIONARY',
        alertId: String(alertId),
      };

      this.send(message);
    }

    getTextStats() {
      return this.sendAndWaitForResponse({ action: Action.STATS }, ResponseAction.STATS);
    }

    dismissAlert(alertId: number) {
      const message: IgnoreMessage = {
        action: Action.FEEDBACK,
        type: 'IGNORE',
        alertId: String(alertId),
      };

      this.send(message);
    }

    acceptAlert(alertId: number, text: string) {
      const message: AcceptedMessage = {
        action: Action.FEEDBACK,
        type: 'ACCEPTED',
        alertId: String(alertId),
        text,
      };

      this.send(message);
    }

    setContext(context: DocumentContext) {
      const message: ContextMessage = {
        action: Action.CONTEXT,
        documentContext: context,
        rev: this.currentRevision,
      };

      this.send(message);
    }

    set(key: string, value: string | number | boolean) {
      const option: OptionMessage = {
        action: Action.OPTION,
        name: key,
        value: value,
      };

      this.send(option);
    }

    private async sendAndWaitForResponse<T extends Action>(
      message: IMessage<T>,
      expecting: string = message.action
    ): Promise<ResponseTypes[T]> {
      return new Promise<any>((resolve, reject) => {
        const handler = (response: Response) => {
          debug('Expecting: ' + id + ' Got: ' + response.id);
          if (response.id === id) {
            this.off(message.action, handler);
            this.off(Action.ERROR, handler);

            response.action === Action.ERROR ? reject(response) : resolve(response);
          }
        };

        debug('Schedule a handler for: ' + message.action);
        this.on(expecting as any, handler);
        this.on(Action.ERROR, handler);

        const id = this.send(message);
      });
    }

    private ots: Message[] = [];
    private sendDebounced(message: Message) {
      this.ots.push(message);
      this.flushOTsDebounced();
    }

    private flushOTsDebounced = debounce(() => this.flushOTs(), 500, {
      maxWait: 2000,
      leading: false,
      trailing: true,
    });

    private flushOTs() {
      this.ots.forEach((message) => this.send(message));
      this.ots.length = 0;
    }

    private pendingResponses = 0;
    private onResponse(response: Response) {
      if (this.pendingResponses > 0) this.pendingResponses--;

      if (response.action !== ResponseAction.PONG) debug('🔻', response);
      debug(`status: queue=${this.queue.length}, pending=${this.pendingResponses}`);

      if (this.status === 'inactive') {
        if (isResponseType(response, Action.START)) {
          this._status = 'active';
          this.flushQueue();
          let missed = 0;
          this.intervalHandle = setInterval(() => {
            if (this.pendingResponses < 10) {
              missed = 0;
              this.send({ action: Action.PING });
            } else {
              debug(`socket stuck with ${this.queue.length} messages and ${this.pendingResponses} pending responses`);
              if (missed++ > 2) {
                debug('restart frozen socket');
                this.refresh();
              }
            }
          }, 10000);
        } else {
          this._status = 'broken';
        }
      } else {
        this.flushQueue();
      }

      this.emit(response.action, response);
    }

    private flushQueue() {
      if (this.status === 'active') {
        let i = 0;
        while (this.queue.length && this.pendingResponses < 10 && i++ < 10) {
          this.send(this.queue.shift()!);
        }
      }
    }

    private send(message: Message): number {
      this.flushQueue();

      const payload: any = {
        ...message,
      };

      if (!('id' in payload)) {
        payload.id = ++this.currentMessageId;
      }

      if (this.socket && (this.status === 'active' || message.action === Action.START) && this.pendingResponses <= 10) {
        if (message.action !== Action.PING) debug('🔺', payload);
        debug(`status: queue=${this.queue.length}, pending=${this.pendingResponses}`);
        this.pendingResponses++;
        this.socket.send(JSON.stringify(payload));
      } else this.queue.push(payload);

      return payload.id;
    }
  }
}
