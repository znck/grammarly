/// <reference lib="WebWorker" />

import { LanguageClient } from 'vscode-languageclient/browser'
import type { GrammarlyLanguageClientOptions } from './GrammarlyLanguageClientOptions'
import { createProtocol, Protocol } from './protocol'

export class GrammarlyLanguageClient extends LanguageClient {
  public readonly protocol: Protocol

  public constructor(serverPath: string, options: GrammarlyLanguageClientOptions) {
    super(
      options.id,
      options.name,
      {
        ...options,
        initializationOptions: {
          clientId: options.id,
          ...options.initializationOptions,
        },
      },
      new Worker(serverPath, {}),
    )
    this.protocol = createProtocol(this)
  }
}
