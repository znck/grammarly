import { DocumentContext } from 'unofficial-grammarly-api'
import { DiagnosticSeverity } from 'vscode'

export interface GrammarlySettings extends DocumentContext {
  /** Extension Config */
  autoActivate: boolean
  ignore: string[]
  userWords: string[]
  diagnostics: Record<
    string,
    {
      ignore: string[]
    }
  >
  severity: Record<string, DiagnosticSeverity>

  /** Grammarly Document Config */
  overrides: Array<{
    files: string[]
    config: Partial<DocumentContext>
  }>

  debug: boolean
  showUsernameInStatusBar: boolean
  showDeletedTextInQuickFix: boolean
  showExplanation: boolean
  showExamples: boolean
  hideUnavailablePremiumAlerts: boolean
}

export const DEFAULT: GrammarlySettings = {
  /** Extension Config */
  autoActivate: true,
  ignore: [],
  severity: {
    Determiners: DiagnosticSeverity.Error,
    Misspelled: DiagnosticSeverity.Error,
    Unknown: DiagnosticSeverity.Error,
    ClosingPunct: DiagnosticSeverity.Error,
    Nouns: DiagnosticSeverity.Error,

    OddWords: DiagnosticSeverity.Warning,
    CompPunct: DiagnosticSeverity.Warning,
    Clarity: DiagnosticSeverity.Warning,
    Dialects: DiagnosticSeverity.Warning,

    WordChoice: DiagnosticSeverity.Information,
    Readability: DiagnosticSeverity.Information,

    PassiveVoice: DiagnosticSeverity.Hint,

    _default: DiagnosticSeverity.Hint,
  },
  userWords: [],
  diagnostics: {
    '[markdown]': {
      ignore: ['code'],
    },
    '[rmd]': {
      ignore: ['code'],
    },
    '[mdx]': {
      ignore: ['code'],
    },
  },

  /** Grammarly Config */
  audience: 'knowledgeable',
  dialect: 'american',
  domain: 'general',
  emotions: [],
  goals: [],
  style: 'neutral',

  /** Grammarly Document Config */
  overrides: [],

  /** Internal */
  debug: false,
  showUsernameInStatusBar: true,
  showDeletedTextInQuickFix: true,
  showExplanation: true,
  showExamples: false,
  hideUnavailablePremiumAlerts: false,
}
