import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node'
export interface GrammarlyLanguageClientOptions extends LanguageClientOptions {
  id: string
  name: string
}

export class GrammarlyLanguageClient extends LanguageClient {
  constructor(serverPath: string, options: GrammarlyLanguageClientOptions) {
    super(options.id, options.name, getLanguageServerOptions(serverPath), {
      ...options,
      initializationOptions: {
        clientId: options.id,
        ...options.initializationOptions,
      },
    })
  }
}

function getLanguageServerOptions(module: string): ServerOptions {
  return {
    run: { module, transport: TransportKind.ipc },
    debug: {
      module,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect=6009'],
      },
    },
  }
}
