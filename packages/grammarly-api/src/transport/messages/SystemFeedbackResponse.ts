import { SystemFeedbackType } from '../enums/SystemFeedbackType'
import { BaseFeedbackAckResponse } from './BaseFeedbackAckResponse'

export interface SystemFeedbackResponse extends BaseFeedbackAckResponse {
  type: SystemFeedbackType
}
