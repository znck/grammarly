import { MutedFeedbackType } from '../enums/MutedFeedbackType';
import { BaseFeedbackAckResponse } from './BaseFeedbackAckResponse';

export interface MutedFeedbackResponse extends BaseFeedbackAckResponse {
  type: MutedFeedbackType;
}
