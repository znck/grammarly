import { Grammarly } from './grammarly'

export interface GrammarlySettings {
  username: string | undefined
  password: string | undefined
  dialect: Grammarly.Dialect
  userWords: string[]
}

export const DEFAULT_SETTINGS: GrammarlySettings = {
  username: undefined,
  password: undefined,
  dialect: Grammarly.Dialect.AMERICAN,
  userWords: [],
}
