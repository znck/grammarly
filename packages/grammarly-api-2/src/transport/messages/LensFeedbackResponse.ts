import { LensFeedbackType } from '../enums/LensFeedbackType'
import { BaseFeedbackAckResponse } from './BaseFeedbackAckResponse'

export interface LensFeedbackResponse extends BaseFeedbackAckResponse {
  type: LensFeedbackType
}
