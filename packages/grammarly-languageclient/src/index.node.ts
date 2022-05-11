import { LanguageClient, ServerOptions, TransportKind } from 'vscode-languageclient/node'
import type { GrammarlyLanguageClientOptions } from './GrammarlyLanguageClientOptions'
import { createProtocol, Protocol } from './protocol'

export class GrammarlyLanguageClient extends LanguageClient {
  public readonly protocol: Protocol

  public constructor(serverPath: string, options: GrammarlyLanguageClientOptions) {
    const config = {
      ...options,
      initializationOptions: {
        clientId: options.id,
        ...options.initializationOptions,
      },
    }

    super(options.id, options.name, getLanguageServerOptions(serverPath), config)
    this.protocol = createProtocol(this)
  }
}

function getLanguageServerOptions(module: string): ServerOptions {
  return {
    run: { module, transport: TransportKind.ipc },
    debug: {
      module,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect=5512'],
      },
    },
  }
}

function isNode(): boolean {
  return typeof process !== 'undefined' && process.versions?.node != null
}
