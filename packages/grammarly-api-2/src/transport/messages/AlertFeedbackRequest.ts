import { AlertFeedbackType } from '../enums/AlertFeedbackType';
import { IdAlert } from '../interfaces/IdAlert';
import { BaseFeedbackRequest } from './BaseFeedbackRequest';

export interface AlertFeedbackRequest extends BaseFeedbackRequest {
  type: AlertFeedbackType;
  alertId: IdAlert;
  text?: string;
}
