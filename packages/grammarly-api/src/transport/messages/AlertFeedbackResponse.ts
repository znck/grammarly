import { AlertFeedbackType } from '../enums/AlertFeedbackType'
import { BaseFeedbackAckResponse } from './BaseFeedbackAckResponse'

export interface AlertFeedbackResponse extends BaseFeedbackAckResponse {
  type: AlertFeedbackType
}
