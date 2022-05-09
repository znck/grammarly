import 'reflect-metadata'
import { Container } from 'inversify'
import type { createConnection, TextDocuments, TextDocumentsConfiguration } from 'vscode-languageserver'
import { CLIENT, CLIENT_INFO, CONNECTION, GRAMMARLY_SDK, SERVER, TEXT_DOCUMENTS_FACTORY } from './constants'
import { CodeActionService } from './services/CodeActionService'
import { ConfigurationService } from './services/ConfigurationService'
import { DiagnosticsService } from './services/DiagnosticsService'
import { DocumentService } from './services/DocumentService'
import { HoverService } from './services/HoverService'
import type { SDK } from '@grammarly/sdk'

interface Disposable {
  dispose(): void
}

export interface Options {
  getConnection(): ReturnType<typeof createConnection>
  createTextDocuments<T>(config: TextDocumentsConfiguration<T>): TextDocuments<T>
  init(clientId: string): Promise<SDK>
  pathEnvironmentForSDK(clientId: string): void
}

export function createLanguageServer({
  getConnection,
  createTextDocuments,
  init,
  pathEnvironmentForSDK,
}: Options): () => void {
  return () => {
    const disposables: Disposable[] = []
    const capabilities: any = {}
    const container = new Container({
      autoBindInjectable: true,
      defaultScope: 'Singleton',
    })
    const connection = getConnection()

    console.log = console.debug = (...args) => {
      connection.console.log(args.map(toString).join(' '))
    }
    console.error = (...args) => {
      connection.console.error(args.map(toString).join(' '))
    }
    console.warn = (...args) => {
      connection.console.warn(args.map(toString).join(' '))
    }
    console.info = (...args) => {
      connection.console.info(args.map(toString).join(' '))
    }
    container.bind(CONNECTION).toConstantValue(connection)
    container.bind(SERVER).toConstantValue(capabilities)

    connection.onInitialize(async (params) => {
      const options = params.initializationOptions as { clientId: string } | undefined
      if (options?.clientId == null) throw new Error('clientId is required')
      pathEnvironmentForSDK(options.clientId)
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

function toString(obj: unknown): string {
  switch (typeof obj) {
    case 'string':
      return obj
    case 'number':
    case 'boolean':
      return JSON.stringify(obj)
    default:
      if (obj instanceof Error) return `${obj.message} ${obj.stack}`
      return JSON.stringify(obj)
  }
}
