import { MutedFeedbackType } from '../enums/MutedFeedbackType';
import { BaseFeedbackRequest } from './BaseFeedbackRequest';
import { UserMutedScopeType } from '../enums/UserMutedScopeType';

export interface MutedFeedbackRequest extends BaseFeedbackRequest {
  type: MutedFeedbackType;
  userMuteScope: UserMutedScopeType;
  userMuteCategories: string[];
}
