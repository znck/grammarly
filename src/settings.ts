import { Grammarly } from './server/grammarly';
import { DiagnosticSeverity } from 'vscode-languageserver';

export interface GrammarlySettings extends Grammarly.DocumentContext {
  /** Extension Config */
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
}

export const DEFAULT: GrammarlySettings = {
  /** Extension Config */
  ignore: [],
  severity: {
    Determiners: DiagnosticSeverity.Error,
    Misspelled: DiagnosticSeverity.Error,
    WordChoice: DiagnosticSeverity.Information,
    PassiveVoice: DiagnosticSeverity.Information,
    Readability: DiagnosticSeverity.Information,
    Clarity: DiagnosticSeverity.Warning,
    Dialects: DiagnosticSeverity.Warning,
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
  emotion: Grammarly.WritingTone.MILD,
  emotions: [],
  goals: [],
  style: Grammarly.WritingStyle.NEUTRAL,

  /** Grammarly Document Config */
  overrides: [],
};
