import { Grammarly } from '../shared/grammarly'
export interface GrammarlyDocumentMeta {
  alerts: Record<number, Grammarly.Alert>
  synonyms: Record<string, Grammarly.TokenMeaning[]>
  document: Grammarly.DocumentHost
}

export const env = {
  hasConfigurationCapability: false,
  hasWorkspaceFolderCapability: false,
  hasDiagnosticRelatedInformationCapability: false,
}
