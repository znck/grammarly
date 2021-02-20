import { LensFeedbackType } from '../enums/LensFeedbackType';
import { BaseFeedbackRequest } from './BaseFeedbackRequest';

export interface LensFeedbackRequest extends BaseFeedbackRequest {
  type: LensFeedbackType;
  lens: string;
}
