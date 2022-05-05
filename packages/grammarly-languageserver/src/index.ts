import 'reflect-metadata'
import './polyfill-fetch'
import { init } from '@grammarly/sdk'
import { Container } from 'inversify'
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node'
import { CLIENT, CLIENT_INFO, CONNECTION, GRAMMARLY_SDK, SERVER } from './constants'
import { CodeActionService } from './services/CodeActionService'
import { ConfigurationService } from './services/ConfigurationService'
import { DiagnosticsService } from './services/DiagnosticsService'
import { DocumentService } from './services/DocumentService'
import { HoverService } from './services/HoverService'

interface Disposable {
  dispose(): void
}

export function startLanguageServer(): void {
  const disposables: Disposable[] = []
  const capabilities: any = {}
  const container = new Container({
    autoBindInjectable: true,
    defaultScope: 'Singleton',
  })
  const connection = createConnection(ProposedFeatures.all)

  container.bind(CONNECTION).toConstantValue(connection)
  container.bind(SERVER).toConstantValue(capabilities)

  connection.onInitialize(async (params) => {
    const options = params.initializationOptions as { clientId: string } | undefined
    if (options?.clientId == null) throw new Error('clientId is required')
    const sdk = await init(options.clientId)

    globalThis.open = (url) => {
      connection.sendNotification('$/openOAuthUrl', url)
      return null
    }
    connection.onNotification('$/handleOAuthUrl', (url: string) => {
      sdk.handleOAuthCallback(url)
    })

    container.bind(CLIENT).toConstantValue(params.capabilities)
    container.bind(CLIENT_INFO).toConstantValue({ ...params.clientInfo, id: options.clientId })
    container.bind(GRAMMARLY_SDK).toConstantValue(sdk)

    disposables.push(
      container.get(ConfigurationService).register(),
      container.get(DocumentService).register(),
      container.get(DiagnosticsService).register(),
      container.get(HoverService).register(),
      container.get(CodeActionService).register(),
    )

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
}
