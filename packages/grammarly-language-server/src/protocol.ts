import type { Emotion, Event, IdAlert, OutcomeScoresWithPlagiarism, TextInfoEvent } from 'unofficial-grammarly-api'
import type { CheckHostStatus } from './hosts/CheckHostStatus'
import type { AuthParams } from './interfaces'

export namespace GrammarlyLanguageServer {
  export type DocumentState =
    | {
        uri: string
        status: CheckHostStatus
        score: number
        scores: Partial<OutcomeScoresWithPlagiarism>
        emotions: Emotion[]
        textInfo: Omit<TextInfoEvent, keyof Event> | null
        totalAlertsCount: number
        additionalFixableAlertsCount: number
        premiumAlertsCount: number
        user: { isAnonymous: boolean; isPremium: boolean }
      }
    | {
        uri: string
      }

  export interface DocumentRef {
    uri: string
  }

  export interface FeedbackAcceptAlert extends DocumentRef {
    id: IdAlert
    text: string
  }

  export const Feature = {
    stop: ('$/stop' as unknown) as import('vscode-jsonrpc').RequestType<DocumentRef, void, Error>,
    checkGrammar: ('$/checkGrammar' as unknown) as import('vscode-jsonrpc').RequestType<DocumentRef, void, Error>,
    acceptAlert: ('$/feedbackAcceptAlert' as unknown) as import('vscode-jsonrpc').RequestType<
      FeedbackAcceptAlert,
      void,
      Error
    >,
    getDocumentState: ('$/getDocumentState' as unknown) as import('vscode-jsonrpc').RequestType<
      DocumentRef,
      DocumentState | null,
      Error
    >,
  }

  export namespace Client {
    export const Feature = {
      getCredentials: ('$/getCredentials' as unknown) as import('vscode-jsonrpc').RequestType<AuthParams, void, Error>,
      updateDocumentState: ('$/updateDocumentState' as unknown) as import('vscode-jsonrpc').RequestType<
        DocumentState,
        void,
        Error
      >,
    }
  }
}
