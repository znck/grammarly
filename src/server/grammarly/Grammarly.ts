export function isAck(action: Grammarly.ResponseKind): boolean {
  switch (action) {
    case Grammarly.ResponseKind.START:
    case Grammarly.ResponseKind.SUBMIT_OT:
    case Grammarly.ResponseKind.SUBMIT_OT_CHUNK:
    case Grammarly.ResponseKind.FEEDBACK:
    case Grammarly.ResponseKind.PONG:
    case Grammarly.ResponseKind.OPTION:
    case Grammarly.ResponseKind.TEXT_STATS:
    case Grammarly.ResponseKind.DEBUG_INFO:
    case Grammarly.ResponseKind.SYNONYMS:
    case Grammarly.ResponseKind.SET_CONTEXT:
    case Grammarly.ResponseKind.TOGGLE_CHECKS:
      return true;

    default:
      return false;
  }
}

export function isAckResponse<T extends Grammarly.ResponseKind>(
  response: Grammarly.Response
): response is Extract<Grammarly.Response, Grammarly.Message.Ack & { action: T }> {
  return isAck(response.action);
}

export namespace Grammarly {
  export type Revision = number & { __type: 'Revision' };

  export function getRevision(version: number): Revision {
    return version as Revision;
  }

  export enum RequestKind {
    PING = 'ping',
    START = 'start',
    SUBMIT_OT = 'submit_ot',
    SUBMIT_OT_CHUNK = 'submit_ot_chunk',
    FEEDBACK = 'feedback',
    OPTION = 'option',
    GET_TEXT_STATS = 'get_text_stats',
    GET_DEBUG_INFO = 'get_debug_info',
    SYNONYMS = 'synonyms',
    SET_CONTEXT = 'set_context',
    TOGGLE_CHECKS = 'toggle_checks',
  }

  export enum ResponseKind {
    PONG = 'pong',
    START = 'start',
    SUBMIT_OT = 'submit_ot',
    SUBMIT_OT_CHUNK = 'submit_ot_chunk',
    ALERT = 'alert',
    REMOVE = 'remove',
    ALERT_CHANGES = 'alert_changes',
    FINISHED = 'finished',
    ERROR = 'error',
    FEEDBACK = 'feedback',
    PLAGIARISM = 'plagiarism',
    SYNONYMS = 'synonyms',
    OPTION = 'option',
    TEXT_STATS = 'text_stats',
    EMOTIONS = 'emotions',
    TEXT_MAPS = 'text_maps',
    TEXT_INFO = 'text_info',
    DEBUG_INFO = 'debug_info',
    SET_CONTEXT = 'set_context',
    ASYNC_CHECK_FINISHED = 'async_check_finished',
    COMPLETE = 'complete',
    TAKEAWAYS = 'takeaways',
    HEATMAP = 'heatmap',
    TOGGLE_CHECKS = 'toggle_checks',
  }

  export enum Dialect {
    AMERICAN = 'american',
    AUSTRALIAN = 'australian',
    BRITISH = 'british',
    CANADIAN = 'canadian',
  }

  export enum DocumentDomain {
    ACADEMIC = 'academic',
    BUSINESS = 'business',
    GENERAL = 'general',
    TECHNICAL = 'technical',
    CASUAL = 'casual',
    CREATIVE = 'creative',
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
    FRIENDLY = 'friendly',
    URGENT = 'urgent',
    ANALYTICAL = 'analytical',
    RESPECTFUL = 'respectful',
  }

  export enum Feature {
    ALERTS_CHANGES = 'alerts_changes',
    ALERTS_UPDATE = 'alerts_update',
    ALTERNATIVE_DELETES_CARD = 'alternative_deletes_card',
    ATTENTION_HEATMAP = 'attention_heatmap',
    COMPLETIONS = 'completions',
    CONSISTENCY_CHECK = 'consistency_check',
    DEMO_TEXT_FREE_PREMIUM_ALERTS = 'demo_text_free_premium_alerts',
    EMOGENIE_CHECK = 'emogenie_check',
    FILLER_WORDS_CHECK = 'filler_words_check',
    FREE_CLARITY_ALERTS = 'free_clarity_alerts',
    FREE_INLINE_ADVANCED_ALERTS = 'free_inline_advanced_alerts',
    FULL_SENTENCE_REWRITE_CARD = 'full_sentence_rewrite_card',
    KEY_TAKEAWAYS = 'key_takeaways',
    MUTE_QUOTED_ALERTS = 'mute_quoted_alerts',
    PLAGIARISM_ALERTS_UPDATE = 'plagiarism_alerts_update',
    READABILITY_CHECK = 'readability_check',
    SENTENCE_VARIETY_CHECK = 'sentence_variety_check',
    SET_GOALS_LINK = 'set_goals_link',
    SUPER_ALERTS = 'super_alerts',
    TEXT_INFO = 'text_info',
    TONE_CARDS = 'tone_cards',
    TURN_TO_LIST_CARD = 'turn_to_list_card',
    USER_MUTES = 'user_mutes',
    VOX_CHECK = 'vox_check',
  }

  export enum DocumentGoal {
    INFORM = 'inform',
    DESCRIBE = 'describe',
    CONVINCE = 'convince',
    TELL_A_STORY = 'tellStory',
  }

  export enum DocumentAudience {
    GENERAL = 'general',
    KNOWLEDGEABLE = 'knowledgeable',
    EXPERT = 'expert',
  }

  export interface DocumentContext {
    dialect: Dialect;
    domain: DocumentDomain;
    goals: DocumentGoal[];
    audience?: DocumentAudience;
    style?: WritingStyle;
    emotions: WritingEmotion[];
  }

  export enum OptionType {
    GNAR_CONTAINER_ID = 'gnar_containerId',
  }

  export interface OutcomeScores {
    Clarity: number;
    Correctness: number;
    Engagement: number;
    Tone: number;
    'Style guide': number;
    GeneralScore: number;
  }

  export enum AsyncChecksTypes {
    PLAGIARISM = 'plagiarism',
  }

  export interface OutcomeScoresWithPlagiarism extends OutcomeScores {
    Originality: number;
  }

  export interface DocumentStatistics {
    words: number;
    chars: number;
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
  }

  export interface Synonym {
    base: string;
    derived: string;
  }

  export interface SynonymsGroup {
    synonyms: Synonym[];
    meaning?: string;
  }

  export namespace Message {
    export interface Base {
      action: ResponseKind;
    }

    export interface Ack extends Base {
      id: number;
    }

    export interface BaseRequest {
      id: number;
      action: RequestKind;
    }

    export interface Start extends BaseRequest {
      action: RequestKind.START;
      client: string;
      clientSubtype: string;
      clientVersion: string;
      dialect: Dialect;
      docid: string;
      documentContext?: DocumentContext;
      clientSupports?: Feature[];
    }

    export interface StartAck extends Ack {
      action: ResponseKind.START;
      sid: number;
    }

    export interface Ping extends BaseRequest {
      action: RequestKind.PING;
    }

    export interface Pong extends Ack {
      action: ResponseKind.PONG;
    }

    export interface Option extends BaseRequest {
      action: RequestKind.OPTION;
      name: OptionType;
      value: string;
    }

    export interface OptionAck extends Ack {
      action: ResponseKind.OPTION;
    }

    export interface Finish extends Base {
      action: ResponseKind.FINISHED;
      rev: Revision;
      score: number;
      dialect: Dialect;
      outcomeScores?: Partial<OutcomeScores>;
      generalScore?: Partial<OutcomeScores>;
      removed?: Alert.Id[];
    }

    export interface SetContext extends BaseRequest {
      action: RequestKind.SET_CONTEXT;
      rev: Revision;
      documentContext: DocumentContext;
    }

    export interface SetContextAck extends Ack {
      action: ResponseKind.SET_CONTEXT;
      rev: Revision;
    }

    export interface AsyncCheckFinish extends Base {
      action: ResponseKind.ASYNC_CHECK_FINISHED;
      rev: Revision;
      check: 0;
      outcomeScores: OutcomeScores;
    }

    export interface SubmitOTChunk extends BaseRequest {
      action: RequestKind.SUBMIT_OT_CHUNK;
      rev: Revision;
      doc_len: number;
      deltas: [OT.Delta];
      chunked: false;
    }

    export interface SubmitOTChunkAck extends Ack {
      action: ResponseKind.SUBMIT_OT_CHUNK;
      rev: Revision;
    }

    export interface SubmitOT extends BaseRequest {
      action: RequestKind.SUBMIT_OT;
      rev: Revision;
      doc_len: number;
      deltas: OT.Delta[];
      chunked: false;
    }

    export interface SubmitOTAck extends Ack {
      action: ResponseKind.SUBMIT_OT;
      rev: Revision;
    }

    export type Feedback =
      | UserFeedback.Alert
      | UserFeedback.AutoCorrect
      | UserFeedback.Autocomplete
      | UserFeedback.Emotion
      | UserFeedback.Lens
      | UserFeedback.Mute
      | UserFeedback.RejectedAutocomplete
      | UserFeedback.System
      | UserFeedback.Takeaway;

    export interface FeedbackAck extends UserFeedback.Ack {}

    export interface ToggleChecks extends BaseRequest {
      action: RequestKind.TOGGLE_CHECKS;
      checks: Record<AsyncChecksTypes, boolean>;
    }

    export interface ToggleChecksAck extends Ack {
      action: ResponseKind.TOGGLE_CHECKS;
    }

    export interface GetTextStats extends BaseRequest {
      action: RequestKind.GET_TEXT_STATS;
    }

    export interface TextStats extends Ack, DocumentStatistics {
      action: ResponseKind.TEXT_STATS;
    }

    export interface GetDebugInfo extends BaseRequest {
      action: RequestKind.GET_DEBUG_INFO;
    }

    export interface DebugInfo extends Ack {
      action: ResponseKind.DEBUG_INFO;
      rev: Revision;
      sid: number;
      text: string;
    }

    export interface GetSynonyms extends BaseRequest {
      action: RequestKind.SYNONYMS;
      begin: number;
      token: string;
    }

    export interface Synonyms extends Ack {
      action: ResponseKind.SYNONYMS;
      token: string;
      synonyms: { pos: number; meanings: SynonymsGroup[] };
    }

    export interface Alert extends Base {
      id: Alert.Id;
      action: ResponseKind.ALERT;
      rev: Revision;
      begin: number;
      end: number;
      highlightBegin: number;
      highlightEnd: number;
      text: string;
      pname: string;
      point: string;
      highlightText: string;
      category: string;
      categoryHuman: string;
      group: string;
      title: string;
      details: string;
      examples: string;
      explanation: string;
      transforms: string[];
      replacements: string[];
      free: boolean;
      extra_properties: Alert.ExtraProperties;
      hidden: boolean;
      impact: Alert.Impact;
      cardLayout: Alert.CardLayout;
      sentence_no: number;
      todo: string;
      minicardTitle: string;
      cost?: number;
      updatable?: boolean;
      transformJson?: Alert.RawTransform;
      labels?: string[];
      subalerts?: Array<{
        transformJson: Alert.RawTransform;
        highlightText: string;
        label: string;
      }>;
      muted?: Alert.MutedByType;
      view?: Alert.View;
    }

    export interface Remove {
      id: Alert.Id;
      action: ResponseKind.REMOVE;
      hint?: 'NOT_FIXED';
      mergedIn?: number;
    }

    export interface AlertsChanged extends Base {
      action: ResponseKind.ALERT_CHANGES;
      extra_properties?: Alert.ExtraProperties;
      rev: Revision;
      transformJson?: Alert.RawTransform;
      muted?: Alert.MutedByType;
    }

    export interface Finished extends Base {
      action: ResponseKind.FINISHED;
      rev: Revision;
      score: number;
      dialect: Dialect;
      outcomeScores?: Partial<OutcomeScores>;
      generalScore?: number;
      removed?: Alert.Id[];
    }

    export interface Error extends Base {
      action: ResponseKind.ERROR;
      error: ErrorCode;
      severity: ErrorSeverity;
    }

    export interface Plagiarism extends Base {
      action: ResponseKind.PLAGIARISM;
    }

    export interface Emotions extends Base {
      action: ResponseKind.EMOTIONS;
    }

    export interface Emotions extends Base {
      action: ResponseKind.EMOTIONS;
      emotions: Emogenie.Emotion[];
    }

    export interface TextMaps extends Base {
      action: ResponseKind.TEXT_MAPS;
      score: number;
      generalScore: number;
      // TODO(next): check this!
    }

    export interface TextInfo extends Base {
      action: ResponseKind.TEXT_INFO;
      wordsCount: number;
      charsCount: number;
      readabilityScore: number;
      messages?: {
        assistantHeader: string;
      };
    }

    export interface Complete extends Base {
      action: ResponseKind.COMPLETE;
      completions: Array<{
        text: string;
        patternName: string;
        prefixBegin: number;
        prefixEnd: number;
        textBegin: number;
        textEnd: number;
        confidence: number;
        confidenceCurve: Readonly<Record<number, number>>;
      }>;
      threshold: number;
      rev: Revision;
    }

    export interface Takeaways extends Base {
      action: ResponseKind.TAKEAWAYS;
      add: Takeaway[];
      update: Takeaway[];
      remove: Takeaway.Id[];
      rev: Revision;
    }

    export interface Heatmap extends Base {
      action: ResponseKind.HEATMAP;
      add: Heatmap.Range[];
      update: Heatmap.Range[];
      remove: Heatmap.Id[];
      rev: Revision;
      originalRev: Revision;
      version: number;
    }
  }

  export namespace UserFeedback {
    export enum AlertFeedbackType {
      IGNORE = 'IGNORE',
      ADD_TO_DICTIONARY = 'ADD_TO_DICTIONARY',
      LOOKED = 'LOOKED',
      ACCEPTED = 'ACCEPTED',
      CLOSED = 'CLOSED',

      // Denali feedback types:
      LIKE = 'LIKE',
      DISLIKE = 'DISLIKE',
      WRONG_SUGGESTION = 'WRONG_SUGGESTION',
      OFFENSIVE_CONTENT = 'OFFENSIVE_CONTENT',
      EXPANDED = 'EXPANDED',
    }

    export enum LensFeedbackType {
      LENS_CLOSE = 'LENS_CLOSE',
      LENS_OPEN = 'LENS_OPEN',
      DISMISS_BY_LENS = 'DISMISS_BY_LENS',
    }

    export enum EmotionFeedbackType {
      EMOTION_LIKE = 'EMOTION_LIKE',
      EMOTION_DISLIKE = 'EMOTION_DISLIKE',
    }

    export enum SystemFeedbackType {
      RECHECK_SHOWN = 'RECHECK_SHOWN',
    }

    export enum SynonymFeedbackType {
      SYNONYM_ACCEPTED = 'SYNONYM_ACCEPTED',
    }

    export enum MutedFeedbackType {
      MUTE = 'MUTE',
      UNMUTE = 'UNMUTE',
    }

    export enum AutoCorrectFeedbackType {
      AUTOCORRECT_ACCEPT = 'AUTOCORRECT_ACCEPT',
      AUTOCORRECT_DISMISS = 'AUTOCORRECT_DISMISS',
      AUTOCORRECT_REPLACE = 'AUTOCORRECT_REPLACE',
    }

    export enum AutocompleteFeedbackType {
      COMPLETION_SHOWN = 'COMPLETION_SHOWN',
      COMPLETION_IGNORED = 'COMPLETION_IGNORED',
      COMPLETION_ACCEPTED = 'COMPLETION_ACCEPTED',
      COMPLETION_REJECTED = 'COMPLETION_REJECTED',
    }

    export type FeedbackType =
      | AlertFeedbackType
      | LensFeedbackType
      | EmotionFeedbackType
      | SystemFeedbackType
      | MutedFeedbackType
      | AutoCorrectFeedbackType
      | AutocompleteFeedbackType
      | TakeawayFeedbackType;

    export enum TakeawayFeedbackType {
      TAKEAWAY_LIKE = 'TAKEAWAY_LIKE',
      TAKEAWAY_DISLIKE = 'TAKEAWAY_DISLIKE',
      TAKEAWAY_LOOKED = 'TAKEAWAY_LOOKED',
    }

    export interface Base extends Message.BaseRequest {
      type: FeedbackType;
    }

    export interface Ack extends Message.Ack {
      type: FeedbackType;
      scores?: OutcomeScores;
    }

    export interface Alert extends Base {
      type: AlertFeedbackType;
      alertId: Alert.Id;
      text?: string;
    }

    export interface Lens extends Base {
      type: LensFeedbackType;
      lens: string;
    }

    export interface Emotion extends Base {
      type: EmotionFeedbackType;
      emotion: string;
    }

    export interface System extends Base {
      type: SystemFeedbackType;
    }

    export interface Mute extends Base {
      type: MutedFeedbackType;
      userMuteScope: Alert.ScopeType;
      userMuteCategories: string[];
    }

    export namespace Autocomplete {
      export enum SuggestionRejectionReason {
        NOT_RELEVANT = 'NOT_RELEVANT',
        WRONG_TONE = 'WRONG_TONE',
        INCORRECT = 'INCORRECT',
        WRONG_GRAMMAR = 'WRONG_GRAMMAR',
        OFFENSIVE = 'OFFENSIVE',
        OTHER = 'OTHER',
      }
    }

    interface AutocompleteBase extends Base {
      alertId: Alert.Id;
      begin: number;
      end: number;
      context: string;
      before: string;
      after: string;
      text: string;
      pname: string;
    }

    export interface Autocomplete extends AutocompleteBase {
      type: Exclude<AutocompleteFeedbackType, AutocompleteFeedbackType.COMPLETION_REJECTED>;
    }

    export interface RejectedAutocomplete extends AutocompleteBase {
      type: AutocompleteFeedbackType.COMPLETION_REJECTED;
      subtype?: Autocomplete.SuggestionRejectionReason;
    }

    export interface AutoCorrect extends Base {
      type: AutoCorrectFeedbackType;
      before: string;
      after: string;
      context: string;
      expected?: string;
    }

    export interface Takeaway extends Base {
      type: TakeawayFeedbackType;
      takeawayId: Takeaway.Id;
    }
  }

  export enum ErrorSeverity {
    INFO,
    WARN,
    ERROR,
  }

  export enum ErrorCode {
    NOT_AUTHORIZED = 'not_authorized',
    SESSION_NOT_INITIALIZED = 'session_not_initialized',
    BAD_REQUEST = 'bad_request',
    BACKEND_ERROR = 'backend_error',
    AUTH_ERROR = 'auth_error',
    RUNTIME_ERROR = 'runtime_error',
    ILLEGAL_DICT_WORD = 'illegal_dict_word',
    TIMEOUT = 'timeout',
    CANNOT_FIND_SYNONYM = 'cannot_find_synonym',
    CANNOT_GET_TEXT_STATS = 'cannot_get_text_stats',
  }

  export type Request =
    | Message.Ping
    | Message.Start
    | Message.SubmitOT
    | Message.SubmitOTChunk
    | Message.Feedback
    | Message.Option
    | Message.GetTextStats
    | Message.GetDebugInfo
    | Message.GetSynonyms
    | Message.SetContext
    | Message.ToggleChecks;

  export type Response =
    | Message.Pong
    | Message.StartAck
    | Message.SubmitOTAck
    | Message.SubmitOTChunkAck
    | Message.Alert
    | Message.Remove
    | Message.AlertsChanged
    | Message.Finished
    | Message.Error
    | Message.FeedbackAck
    | Message.Plagiarism
    | Message.Synonyms
    | Message.OptionAck
    | Message.TextStats
    | Message.Emotions
    | Message.TextMaps
    | Message.TextInfo
    | Message.DebugInfo
    | Message.SetContextAck
    | Message.AsyncCheckFinish
    | Message.Complete
    | Message.Takeaways
    | Message.Heatmap
    | Message.ToggleChecksAck;

  export namespace Emogenie {
    export interface Emotion {
      emoji: string;
      name: string;
      confidence: number;
    }
  }

  export interface Alert extends Message.Alert {}

  export namespace Alert {
    export enum ScopeType {
      GLOBAL = 'GLOBAL',
      /**
       * Can be used for testing purposes
       */
      SESSION = 'SESSION',
      /**
       * Currently not supported
       */
      DOCUMENT = 'DOCUMENT',
    }
    export type Prediction = 'emogenie' | 'clarity';
    export interface CardLayout {
      category: string;
      group: string;
      groupDescription: string;
      rank: number;
      outcome: string;
      outcomeDescription: string;
      prediction?: Prediction;
      userMuteCategory?: string;
      userMuteCategoryDescription?: string;
    }

    export type Id = number & { __type: 'AlertId' };
    export interface PlagiarismExtraProperties {
      source: 'WEB_PAGE' | 'PUBLICATION';
      percent: string;
      title: string;
      authors: string;
      reference_apa: string;
      reference_chicago: string;
      reference_mla: string;
    }
    export interface VoxExtraProperties {
      voxCompanyName: string;
      voxLogoUrl: string;
    }

    export interface FluencyExtraProperties {
      fluency_message: string;
    }

    export interface EmogenieExtraProperties {
      tone: string;
      emoji: string;
      full_sentence_rewrite: string;
    }

    export type ExtraProperties = Partial<
      {
        add_to_dict: string;
        did_you_mean: string;
        show_title: string;
        enhancement: string;
        url: string;
        sentence: string;
        priority: string;

        // C+E checks
        progress: number;
      } & PlagiarismExtraProperties &
        VoxExtraProperties &
        FluencyExtraProperties &
        EmogenieExtraProperties
    >;

    export enum Impact {
      Critical = 'critical',
      Advanced = 'advanced',
    }

    export enum MutedByType {
      MUTED_BY_USER = 'MUTED_BY_USER',
      NOT_ELIGIBLE_FOR_INLINE = 'NOT_ELIGIBLE_FOR_INLINE',
      NOT_MUTED = 'NOT_MUTED',
    }

    export enum View {
      all = 'all',
      priority = 'priority',
    }

    export interface Range {
      s: number;
      e: number;
      type?: 'main' | 'focus';
    }

    export interface RawTransform {
      highlights: Range[];
      context: Range;
      alternatives?: OT.Delta;
    }
  }

  export interface Takeaway {
    id: Takeaway.Id;
    begin: number;
    end: number;
    text: string;
    show: boolean;
    score: number;
    threshold: number;
    msg: string;
  }

  export namespace Takeaway {
    export type Id = string & { __type: 'Takeaway' };
  }

  export namespace Heatmap {
    export type Id = string & { __type: 'Heatmap' };
    export interface Range {
      id: Id;
      begin: number;
      end: number;
      text: string;
      intensities: [number, number];
    }
  }

  export namespace OT {
    export interface Delta {
      ops: Operation[];
    }

    export type Retain = { retain: number };
    export type Insert = { insert: string };
    export type Delete = { delete: number };

    export type Operation = Retain | Insert | Delete;

    export interface TextRange {
      start: number;
      end: number;
    }

    export namespace TextRange {
      export function rebase(r: TextRange, cs: TextChange[]): TextRange {
        return cs.reduce((a, c) => {
          const o = TextChange.getTransformOffset(c);

          return {
            start: c.pos <= a.start ? a.start + o : a.start,
            end: c.pos < a.end ? a.end + o : a.end,
          };
        }, r);
      }
    }

    export interface TextChangeInsert {
      type: TextChange.Type.INS;
      pos: number;
      text: string;
    }

    export interface TextChangeDelete {
      type: TextChange.Type.DEL;
      pos: number;
      length: number;
    }

    export type TextChange = TextChangeInsert | TextChangeDelete;

    export namespace TextChange {
      export enum Type {
        INS,
        DEL,
      }

      export function isIns(x: TextChange): x is TextChangeInsert {
        return x.type === Type.INS;
      }

      export function ins(pos: number, text: string): TextChangeInsert {
        return {
          type: Type.INS,
          pos: pos,
          text: text,
        };
      }

      export function isDel(x: TextChange): x is TextChangeDelete {
        return x.type === Type.DEL;
      }

      export function del(pos: number, length: number): TextChangeDelete {
        return {
          type: Type.DEL,
          pos: pos,
          length: length,
        };
      }

      export function applyChanges(text: string, changes: TextChange[]) {
        return changes.reduce((t, c) => {
          if (isIns(c)) {
            return t.slice(0, c.pos) + c.text + t.slice(c.pos);
          } else if (isDel(c)) {
            return t.slice(0, c.pos) + t.slice(c.pos + c.length);
          } else {
            throw new Error(`Unexpected change: ${c}`);
          }
        }, text);
      }

      export function getTransformOffset(c: TextChange) {
        if (isIns(c)) return c.text.length;
        else if (isDel(c)) return -c.length;
        else throw new Error(`Unexpected change: ${c}`);
      }
    }

    export interface TextRangeTransform {
      startOffset: number;
      endOffset: number;
    }

    export class ChangeSet {
      private ops: Operation[] = [];
      private deltas: Delta[] = [];
      private changes: TextChange[] = [];

      constructor(private callback: (deltas: Delta[], changes: TextChange[]) => Promise<void>) {}

      insertText(position: number, text: string) {
        if (position) this.ops.push({ retain: position });
        this.ops.push({ insert: text });
        this.changes.push(TextChange.ins(position, text));

        return this;
      }

      deleteText(position: number, length: number) {
        if (position) this.ops.push({ retain: position });
        this.ops.push({ delete: length });
        this.changes.push(TextChange.del(position, length));

        return this;
      }

      setText(text: string) {
        this.ops.push({ insert: text });

        return this;
      }

      commit() {
        if (this.ops.length) {
          this.deltas.push({ ops: this.ops });
          this.ops = [];
        }

        return this;
      }

      apply(): Promise<void> {
        return this.commit().callback(this.deltas, this.changes);
      }
    }
  }
}
