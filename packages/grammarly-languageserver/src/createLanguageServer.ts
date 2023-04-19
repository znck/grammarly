import 'reflect-metadata'
import { Container } from 'inversify'
import type {
  createConnection,
  ServerCapabilities,
  TextDocuments,
  TextDocumentsConfiguration,
} from 'vscode-languageserver'
import {
  CLIENT,
  CLIENT_INFO,
  CLIENT_INITIALIZATION_OPTIONS,
  CONNECTION,
  GRAMMARLY_SDK,
  SERVER,
  TEXT_DOCUMENTS_FACTORY,
} from './constants'
import { CodeActionService } from './services/CodeActionService'
import { ConfigurationService } from './services/ConfigurationService'
import { DiagnosticsService } from './services/DiagnosticsService'
import { DocumentService } from './services/DocumentService'
import { HoverService } from './services/HoverService'
import type { SDK } from '@grammarly/sdk'
import { InitializationOptions } from './interfaces/InitializationOptions'

interface Disposable {
  dispose(): void
}

export interface Options {
  getConnection(): ReturnType<typeof createConnection>
  createTextDocuments<T>(config: TextDocumentsConfiguration<T>): TextDocuments<T>
  init(clientId: string): Promise<SDK>
  pathEnvironmentForSDK(clientId: string): void | Promise<void>
}

export function createLanguageServer({
  getConnection,
  createTextDocuments,
  init,
  pathEnvironmentForSDK,
}: Options): () => void {
  return () => {
    const disposables: Disposable[] = []
    const capabilities: ServerCapabilities = {}
    const container = new Container({
      autoBindInjectable: true,
      defaultScope: 'Singleton',
    })
    const connection = getConnection()

    container.bind(CONNECTION).toConstantValue(connection)
    container.bind(SERVER).toConstantValue(capabilities)

    connection.onInitialize(async (params) => {
      connection.console.log('Initializing...')
      const options = params.initializationOptions as InitializationOptions | undefined
      if (options?.clientId == null) {
        connection.console.error('Error: clientId is required')
        throw new Error('clientId is required')
      }
      await pathEnvironmentForSDK(options.clientId)
      const sdk = await init(options.clientId)

      container.bind(CLIENT).toConstantValue(params.capabilities)
      container.bind(CLIENT_INFO).toConstantValue({ ...params.clientInfo, id: options.clientId })
      container.bind(CLIENT_INITIALIZATION_OPTIONS).toConstantValue(options)
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

      connection.onRequest('$/isUserAccountConnected', async () => {
        return sdk.isUserAccountConnected
      })

      connection.onRequest('$/getOAuthUrl', async (oauthRedirectUri: string) => {
        try {
          return await sdk.getOAuthUrl(oauthRedirectUri)
        } catch (error) {
          console.error(error)
          throw error
        }
      })

      connection.onRequest('$/logout', async () => {
        await sdk.logout()
      })

      sdk.addEventListener('isUserAccountConnected', () => {
        connection.sendNotification('$/onUserAccountConnectedChange', {
          isUserAccountConnected: sdk.isUserAccountConnected,
        })
      })

      return {
        serverInfo: {
          name: 'Grammarly',
        },
        capabilities,
      }
    })

    connection.onInitialized(() => {
      connection.console.log('Initialized!')
    })

    connection.onExit(() => {
      disposables.forEach((disposable) => disposable.dispose())
    })

    connection.listen()
    connection.console.log('Ready!')
  }
}
