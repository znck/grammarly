import { EmotionFeedbackType } from '../enums/EmotionFeedbackType';
import { BaseFeedbackAckResponse } from './BaseFeedbackAckResponse';

export interface EmotionFeedbackResponse extends BaseFeedbackAckResponse {
  type: EmotionFeedbackType;
}
