import { TextDocument } from 'vscode-languageserver-textdocument'

export interface GrammarlyLanguageClientOptions {
  info?: {
    name: string
    version?: string
  }
  getCredentials: () => Promise<{ username: string; password: string } | string | null>
  getIgnoredDocuments?: (uri: string) => string[]
  onError?: (error: string, actions: string[]) => Promise<string | null>
  saveToken?: (token: string | null) => Promise<void>
  loadToken?: () => Promise<string | null>
}
