import { Grammarly } from './server/grammarly';
import { DiagnosticSeverity } from 'vscode-languageserver';

export interface GrammarlySettings extends Grammarly.DocumentContext {
  /** Extension Config */
  autoActivate: boolean;
  ignore: string[];
  userWords: string[];
  diagnostics: Record<
    string,
    {
      ignore: string[];
    }
  >;
  severity: Record<string, DiagnosticSeverity>;

  /** Grammarly Document Config */
  overrides: Array<{
    files: string[];
    config: Partial<Grammarly.DocumentContext>;
  }>;

  debug: boolean;
  showExplanation: boolean;
  showExamples: boolean;
  hideUnavailablePremiumAlerts: boolean;
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
    '[mdx]': {
      ignore: ['code'],
    },
  },

  /** Grammarly Config */
  audience: Grammarly.DocumentAudience.KNOWLEDGEABLE,
  dialect: Grammarly.Dialect.AMERICAN,
  domain: Grammarly.DocumentDomain.GENERAL,
  emotions: [],
  goals: [],
  style: Grammarly.WritingStyle.NEUTRAL,

  /** Grammarly Document Config */
  overrides: [],

  /** Internal */
  debug: false,
  showExplanation: true,
  showExamples: false,
  hideUnavailablePremiumAlerts: false,
};
