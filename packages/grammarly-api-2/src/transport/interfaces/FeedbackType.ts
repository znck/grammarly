import { AlertFeedbackType } from '../enums/AlertFeedbackType';
import { AutocompleteFeedbackType } from '../enums/AutocompleteFeedbackType';
import { AutoCorrectFeedbackType } from '../enums/AutoCorrectFeedbackType';
import { EmotionFeedbackType } from '../enums/EmotionFeedbackType';
import { LensFeedbackType } from '../enums/LensFeedbackType';
import { MutedFeedbackType } from '../enums/MutedFeedbackType';
import { SystemFeedbackType } from '../enums/SystemFeedbackType';
import { TakeawayFeedbackType } from '../enums/TakeawayFeedbackType';

export type FeedbackType =
  | AlertFeedbackType
  | LensFeedbackType
  | EmotionFeedbackType
  | SystemFeedbackType
  | MutedFeedbackType
  | AutoCorrectFeedbackType
  | AutocompleteFeedbackType
  | TakeawayFeedbackType;
