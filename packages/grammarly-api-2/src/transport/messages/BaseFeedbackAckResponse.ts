import { FeedbackType } from '../interfaces/FeedbackType';
import { OutcomeScores } from '../interfaces/OutcomeScores';
import { BaseAckResponse } from './BaseAckResponse';

export interface BaseFeedbackAckResponse extends BaseAckResponse {
  type: FeedbackType;
  scores?: OutcomeScores;
}
