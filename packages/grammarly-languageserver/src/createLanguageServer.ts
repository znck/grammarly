import 'reflect-metadata'
import { init } from '@grammarly/sdk'
import { Container } from 'inversify'
import type { createConnection, TextDocuments, TextDocumentsConfiguration } from 'vscode-languageserver'
import { CLIENT, CLIENT_INFO, CONNECTION, GRAMMARLY_SDK, SERVER, TEXT_DOCUMENTS_FACTORY } from './constants'
import { CodeActionService } from './services/CodeActionService'
import { ConfigurationService } from './services/ConfigurationService'
import { DiagnosticsService } from './services/DiagnosticsService'
import { DocumentService } from './services/DocumentService'
import { HoverService } from './services/HoverService'

interface Disposable {
  dispose(): void
}
console.log = console.warn = console.info = console.error
export interface Options {
  getConnection(): ReturnType<typeof createConnection>
  createTextDocuments<T>(config: TextDocumentsConfiguration<T>): TextDocuments<T>
}

export function createLanguageServer({ getConnection, createTextDocuments }: Options): () => void {
  return () => {
    const disposables: Disposable[] = []
    const capabilities: any = {}
    const container = new Container({
      autoBindInjectable: true,
      defaultScope: 'Singleton',
    })
    const connection = getConnection()

    container.bind(CONNECTION).toConstantValue(connection)
    container.bind(SERVER).toConstantValue(capabilities)

    connection.onInitialize(async (params) => {
      const options = params.initializationOptions as { clientId: string } | undefined
      if (options?.clientId == null) throw new Error('clientId is required')
      const sdk = await init(options.clientId)

      container.bind(CLIENT).toConstantValue(params.capabilities)
      container.bind(CLIENT_INFO).toConstantValue({ ...params.clientInfo, id: options.clientId })
      container.bind(GRAMMARLY_SDK).toConstantValue(sdk)
      container.bind(TEXT_DOCUMENTS_FACTORY).toConstantValue(createTextDocuments)

      disposables.push(
        container.get(ConfigurationService).register(),
        container.get(DocumentService).register(),
        container.get(DiagnosticsService).register(),
        container.get(HoverService).register(),
        container.get(CodeActionService).register(),
      )

      connection.onRequest('$/handleOAuthCallbackUri', async (url: string) => {
        await sdk.handleOAuthCallback(url)
      })

      connection.console.log('Initialized!')

      return {
        serverInfo: {
          name: 'Grammarly',
        },
        capabilities,
      }
    })

    connection.onExit(() => {
      disposables.forEach((disposable) => disposable.dispose())
    })

    connection.listen()
    connection.console.log('Ready!')
  }
}
