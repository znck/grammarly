import { OutcomeScores } from './OutcomeScores';

export interface OutcomeScoresWithPlagiarism extends OutcomeScores {
  Originality: number;
}
