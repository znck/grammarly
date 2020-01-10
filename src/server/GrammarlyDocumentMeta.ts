import { Grammarly } from '../grammarly'
export interface GrammarlyDocumentMeta {
  alerts: Record<number, Grammarly.Alert>
  synonyms: Record<string, Grammarly.TokenMeaning[]>
  document: Grammarly.DocumentHost
}
