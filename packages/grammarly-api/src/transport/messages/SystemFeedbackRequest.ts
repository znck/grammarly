import { SystemFeedbackType } from '../enums/SystemFeedbackType';
import { BaseFeedbackRequest } from './BaseFeedbackRequest';

export interface SystemFeedbackRequest extends BaseFeedbackRequest {
  type: SystemFeedbackType;
}
