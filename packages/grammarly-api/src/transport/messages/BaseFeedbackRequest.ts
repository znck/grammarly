import { FeedbackType } from '../interfaces/FeedbackType';
import { BaseRequest } from './BaseRequest';

export interface BaseFeedbackRequest extends BaseRequest {
  type: FeedbackType;
}
