import { RequestType, RequestType0 } from 'vscode-languageserver';
import { AuthParams } from './interfaces';
import { Grammarly } from '@/server/grammarly';
import { GrammarlyStatus } from '@/server/grammarly/hosts/TextGrammarCheckHost';

export namespace GrammarlyLanguageServer {
  export interface DocumentState {
    uri: string;
    status: GrammarlyStatus;
    score: number;
    scores: Partial<Grammarly.OutcomeScoresWithPlagiarism>;
    emotions: Grammarly.Emogenie.Emotion[];
    textInfo: Grammarly.Message.TextInfo | null;
    totalAlertsCount: number;
    additionalFixableAlertsCount: number;
    premiumAlertsCount: number;
    user: { isAnonymous: boolean; isPremium: false };
  }

  export interface DocumentRef {
    uri: string;
  }

  export interface FeedbackAcceptAlert extends DocumentRef {
    id: Grammarly.Alert.Id;
    text: string;
  }

  export const Feature = {
    stop: ('$/stop' as unknown) as RequestType<DocumentRef, void, Error>,
    checkGrammar: ('$/checkGrammar' as unknown) as RequestType<DocumentRef, void, Error>,
    acceptAlert: ('$/feedbackAcceptAlert' as unknown) as RequestType<FeedbackAcceptAlert, void, Error>,
    getDocumentState: ('$/getDocumentState' as unknown) as RequestType<DocumentRef, DocumentState | null, Error>,
  };

  export namespace Client {
    export const Feature = {
      getCredentials: ('$/getCredentials' as unknown) as RequestType<AuthParams, void, Error>,
      updateDocumentState: ('$/updateDocumentState' as unknown) as RequestType<DocumentState, void, Error>,
    };
  }
}
