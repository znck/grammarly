import { AlertEvent } from './events/AlertEvent'
import { AlertsChangedEvent } from './events/AlertsChangedEvent'
import { AsyncCheckFinishedEvent } from './events/AsyncCheckFinishedEvent'
import { CompleteEvent } from './events/CompleteEvent'
import { EmotionsEvent } from './events/EmotionsEvent'
import { ErrorEvent } from './events/ErrorEvent'
import { FinishedEvent } from './events/FinishedEvent'
import { HeatmapEvent } from './events/HeatmapEvent'
import { PlagiarismEvent } from './events/PlagiarismEvent'
import { RemoveEvent } from './events/RemoveEvent'
import { TakeawaysEvent } from './events/TakeawaysEvent'
import { TextInfoEvent } from './events/TextInfoEvent'
import { TextMapsEvent } from './events/TextMapsEvent'
import { AlertFeedbackResponse } from './messages/AlertFeedbackResponse'
import { DebugInfoResponse } from './messages/DebugInfoResponse'
import { EmotionFeedbackResponse } from './messages/EmotionFeedbackResponse'
import { LensFeedbackResponse } from './messages/LensFeedbackResponse'
import { MutedFeedbackResponse } from './messages/MutedFeedbackResponse'
import { OptionResponse } from './messages/OptionResponse'
import { PingResponse } from './messages/PingResponse'
import { SetContextResponse } from './messages/SetContextResponse'
import { StartResponse } from './messages/StartResponse'
import { SubmitOTChunkResponse } from './messages/SubmitOTChunkResponse'
import { SubmitOTResponse } from './messages/SubmitOTResponse'
import { SynonymsResponse } from './messages/SynonymsResponse'
import { SystemFeedbackResponse } from './messages/SystemFeedbackResponse'
import { TextStatsResponse } from './messages/TextStatsResponse'
import { ToggleChecksResponse } from './messages/ToggleChecksResponse'
import { Request } from './Request'
import { RequestKind } from './RequestKind'
import { ResponseKind, ResponseKindType } from './ResponseKind'

export type Event =
  | AlertEvent
  | AlertsChangedEvent
  | AsyncCheckFinishedEvent
  | CompleteEvent
  | EmotionsEvent
  | ErrorEvent
  | FinishedEvent
  | HeatmapEvent
  | PlagiarismEvent
  | RemoveEvent
  | TakeawaysEvent
  | TextInfoEvent
  | TextMapsEvent

export type FeedbackResponse =
  | AlertFeedbackResponse
  | EmotionFeedbackResponse
  | LensFeedbackResponse
  | MutedFeedbackResponse
  | SystemFeedbackResponse

export type Response =
  | AlertEvent
  | AlertsChangedEvent
  | AsyncCheckFinishedEvent
  | CompleteEvent
  | DebugInfoResponse
  | EmotionsEvent
  | ErrorEvent
  | FeedbackResponse
  | FinishedEvent
  | HeatmapEvent
  | OptionResponse
  | PlagiarismEvent
  | PingResponse
  | RemoveEvent
  | SetContextResponse
  | StartResponse
  | SubmitOTResponse
  | SubmitOTChunkResponse
  | SynonymsResponse
  | TakeawaysEvent
  | TextInfoEvent
  | TextMapsEvent
  | TextStatsResponse
  | ToggleChecksResponse

export interface ResponseTypeToResponseMapping {
  [ResponseKind.ALERT]: AlertEvent
  [ResponseKind.ALERT_CHANGES]: AlertsChangedEvent
  [ResponseKind.ASYNC_CHECK_FINISHED]: AsyncCheckFinishedEvent
  [ResponseKind.COMPLETE]: CompleteEvent
  [ResponseKind.DEBUG_INFO]: DebugInfoResponse
  [ResponseKind.EMOTIONS]: EmotionsEvent
  [ResponseKind.ERROR]: ErrorEvent
  [ResponseKind.FEEDBACK]: FeedbackResponse
  [ResponseKind.FINISHED]: FinishedEvent
  [ResponseKind.HEATMAP]: HeatmapEvent
  [ResponseKind.OPTION]: OptionResponse
  [ResponseKind.PING]: PlagiarismEvent
  [ResponseKind.PLAGIARISM]: PingResponse
  [ResponseKind.REMOVE]: RemoveEvent
  [ResponseKind.SET_CONTEXT]: SetContextResponse
  [ResponseKind.START]: StartResponse
  [ResponseKind.SUBMIT_OT]: SubmitOTResponse
  [ResponseKind.SUBMIT_OT_CHUNK]: SubmitOTChunkResponse
  [ResponseKind.SYNONYMS]: SynonymsResponse
  [ResponseKind.TAKEAWAYS]: TakeawaysEvent
  [ResponseKind.TEXT_INFO]: TextInfoEvent
  [ResponseKind.TEXT_MAPS]: TextMapsEvent
  [ResponseKind.TEXT_STATS]: TextStatsResponse
  [ResponseKind.TOGGLE_CHECKS]: ToggleChecksResponse
}

export interface RequestTypeToResponseMapping {
  [RequestKind.DEBUG_INFO]: DebugInfoResponse
  [RequestKind.FEEDBACK]: FeedbackResponse
  [RequestKind.OPTION]: OptionResponse
  [RequestKind.PING]: PingResponse
  [RequestKind.SET_CONTEXT]: SetContextResponse
  [RequestKind.START]: StartResponse
  [RequestKind.SUBMIT_OT]: SubmitOTResponse
  [RequestKind.SUBMIT_OT_CHUNK]: SubmitOTChunkResponse
  [RequestKind.SYNONYMS]: SynonymsResponse
  [RequestKind.TEXT_STATS]: TextStatsResponse
  [RequestKind.TOGGLE_CHECKS]: ToggleChecksResponse
}

export type ResponseOf<T extends Request> = RequestTypeToResponseMapping[T['action']]

export function isResponseType<K extends keyof ResponseTypeToResponseMapping>(
  request: any,
  kind: K,
): request is ResponseTypeToResponseMapping[K] {
  return request.action === kind
}

export function isEvent(message: Response): message is Event {
  switch (message.action) {
    case ResponseKind.START:
    case ResponseKind.SUBMIT_OT:
    case ResponseKind.SUBMIT_OT_CHUNK:
    case ResponseKind.FEEDBACK:
    case ResponseKind.PING:
    case ResponseKind.OPTION:
    case ResponseKind.TEXT_STATS:
    case ResponseKind.DEBUG_INFO:
    case ResponseKind.SYNONYMS:
    case ResponseKind.SET_CONTEXT:
    case ResponseKind.TOGGLE_CHECKS:
      return false

    default:
      return true
  }
}

export function isAckResponse(message: Response): message is Exclude<Response, Event> {
  return !isEvent(message)
}
