import { Grammarly } from './shared/grammarly'

export interface GrammarlySettings {
  /** Grammarly Credentials */
  username: string | undefined
  password: string | undefined

  /** Extension Config */
  ignore: string[]
  userWords: string[]
  diagnostics: Record<
    string,
    {
      ignore: string[]
    }
  >

  /** Grammarly Config */
  audience: Grammarly.DocumentAudience
  dialect: Grammarly.Dialect
  domain: Grammarly.DocumentDomain
  emotion: Grammarly.WritingTone
  emotions: Grammarly.WritingEmotion[]
  goals: Grammarly.DocumentGoal[]
  style: Grammarly.WritingStyle

  /** Grammarly Document Config */
  overrides: Array<{
    files: string[]
    config: Partial<Grammarly.DocumentContext>
  }>
}

export const DEFAULT_SETTINGS: GrammarlySettings = {
  /** Grammarly Credentials */
  username: undefined,
  password: undefined,

  /** Extension Config */
  ignore: [],
  userWords: [],
  diagnostics: {
    '[markdown]': {
      ignore: ['code'],
    },
    '[mdx]': {
      ignore: ['code'],
    },
    '[asciidoc]': {
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
}
