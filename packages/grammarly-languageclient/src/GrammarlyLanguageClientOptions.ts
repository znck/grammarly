import { LanguageClientOptions } from 'vscode-languageclient/browser'

export interface GrammarlyLanguageClientOptions extends LanguageClientOptions {
  id: string
  name: string
}
