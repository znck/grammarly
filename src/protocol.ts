import { Grammarly } from '@/server/grammarly';
import { AuthCookie } from './server/grammarly/auth';

export type DictionaryType = 'grammarly' | 'workspace' | 'folder' | 'user';

export interface DocumentStatistics {
  performance: {
    score: number;
  };
  content: {
    characters: number;
    words: number;
    sentences: number;

    readingTime: string;
    speakingTime: string;
  };
  readability: {
    score: number;
    message: string;
    wordLength: number;
    sentenceLength: number;
  };
  vocubulary: {
    uniqueWords: number;
    rareWords: number;
  };
}

export interface DocumentSummary {
  overall: number;
  username?: string;
  scores: {
    Clarity: number;
    Correctness: number;
    Engagement: number;
    GeneralScore: number;
    Tone: number;
  };
}

export interface GrammarlyServerFeatures {
  check(resourse: string): Promise<void>;
  dismissAlert(resource: string, alertId: number): Promise<void>;
  addToDictionary(resource: string, alertId: number): Promise<void>;

  getSummary(resource: string): Promise<DocumentSummary | null>;
  getStatistics(resource: string): Promise<DocumentStatistics | null>;
}

export interface GrammarlyClientFeatures {
  getCredentials(): Promise<{ username: string; password: string } | null>;
  getCookie(): Promise<AuthCookie | null>;
  setCookie(cookie: AuthCookie): Promise<void>;
}

export interface GrammarlyServerEvents {
  [Grammarly.Action.FEEDBACK](
    uri: string,
    response: Grammarly.FeedbackResponse
  ): void;
  [Grammarly.Action.FINISHED](
    uri: string,
    response: Grammarly.FinishedResponse
  ): void;
}
