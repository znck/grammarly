import { type } from 'os'
import { AlertFeedbackRequest } from './messages/AlertFeedbackRequest'
import { DebugInfoRequest } from './messages/DebugInfoRequest'
import { DebugInfoResponse } from './messages/DebugInfoResponse'
import { EmotionFeedbackRequest } from './messages/EmotionFeedbackRequest'
import { LensFeedbackRequest } from './messages/LensFeedbackRequest'
import { MutedFeedbackRequest } from './messages/MutedFeedbackRequest'
import { OptionRequest } from './messages/OptionRequest'
import { PingRequest } from './messages/PingRequest'
import { SetContextRequest } from './messages/SetContextRequest'
import { StartRequest } from './messages/StartRequest'
import { SubmitOTChunkRequest } from './messages/SubmitOTChunkRequest'
import { SubmitOTRequest } from './messages/SubmitOTRequest'
import { SynonymsRequest } from './messages/SynonymsRequest'
import { SystemFeedbackRequest } from './messages/SystemFeedbackRequest'
import { TextStatsRequest } from './messages/TextStatsRequest'
import { ToggleChecksRequest } from './messages/ToggleChecksRequest'
import { RequestKind } from './RequestKind'

export type FeedbackRequest =
  | AlertFeedbackRequest
  | EmotionFeedbackRequest
  | LensFeedbackRequest
  | MutedFeedbackRequest
  | SystemFeedbackRequest

export type Request =
  | DebugInfoRequest
  | FeedbackRequest
  | OptionRequest
  | PingRequest
  | SetContextRequest
  | StartRequest
  | SubmitOTRequest
  | SubmitOTChunkRequest
  | SynonymsRequest
  | TextStatsRequest
  | ToggleChecksRequest

export interface RequestTypeToRequestMapping {
  [RequestKind.DEBUG_INFO]: DebugInfoRequest
  [RequestKind.FEEDBACK]: FeedbackRequest
  [RequestKind.OPTION]: OptionRequest
  [RequestKind.PING]: PingRequest
  [RequestKind.SET_CONTEXT]: SetContextRequest
  [RequestKind.START]: StartRequest
  [RequestKind.SUBMIT_OT]: SubmitOTRequest
  [RequestKind.SUBMIT_OT_CHUNK]: SubmitOTChunkRequest
  [RequestKind.SYNONYMS]: SynonymsRequest
  [RequestKind.TEXT_STATS]: TextStatsRequest
  [RequestKind.TOGGLE_CHECKS]: ToggleChecksRequest
}

export function isRequestType<K extends keyof RequestTypeToRequestMapping>(
  request: any,
  kind: K,
): request is RequestTypeToRequestMapping[K] {
  return request.action === kind
}
