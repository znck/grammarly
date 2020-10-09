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
export enum ServiceStatus {
  INACTIVE,
  CONNECTING,
  READY,
  WAITING,
  ERRORED,
}

export type DocumentSummary =
  | {
      status: ServiceStatus.INACTIVE | ServiceStatus.CONNECTING | ServiceStatus.ERRORED;
    }
  | {
      status: ServiceStatus.READY | ServiceStatus.WAITING;
      overall: number;
      username?: string;
      scores: {
        Clarity: number;
        Correctness: number;
        Engagement: number;
        GeneralScore: number;
        Tone: number;
      };
    };

export interface GrammarlyServerFeatures {
  check(resource: string): Promise<void>;
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
  ['$/summary'](uri: string, summary: DocumentSummary): void;
}
