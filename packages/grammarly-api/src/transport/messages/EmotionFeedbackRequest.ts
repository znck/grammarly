import { EmotionFeedbackType } from '../enums/EmotionFeedbackType';
import { BaseFeedbackRequest } from './BaseFeedbackRequest';

export interface EmotionFeedbackRequest extends BaseFeedbackRequest {
  type: EmotionFeedbackType;
  emotion: string;
}
