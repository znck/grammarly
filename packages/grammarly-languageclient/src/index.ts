import type { BaseLanguageClient, MessageTransports } from 'vscode-languageclient'
import type { GrammarlyLanguageClientOptions } from './GrammarlyLanguageClientOptions'
import type { Protocol } from './protocol'
export type { GrammarlyLanguageClientOptions } from './GrammarlyLanguageClientOptions'
export declare class GrammarlyLanguageClient extends BaseLanguageClient {
  protected getLocale(): string
  protected createMessageTransports(encoding: string): Promise<MessageTransports>
  constructor(serverPath: string, options: GrammarlyLanguageClientOptions)
  public readonly protocol: Protocol
}
