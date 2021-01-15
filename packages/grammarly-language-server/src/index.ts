import 'reflect-metadata'
import { Container } from 'inversify'
import { createConnection, ProposedFeatures } from 'vscode-languageserver'
import { CLIENT, CLIENT_INFO, CONNECTION, SERVER } from './constants'
import { ConfigurationService } from './services/ConfigurationService'
import { DictionaryService } from './services/DictionaryService'
import { DocumentService } from './services/DocumentService'
import { GrammarlyDiagnosticsService } from './services/GrammarlyDiagnosticsService'

export * from './protocol'

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

  connection.onInitialize((params) => {
    container.bind(CLIENT).toConstantValue(params.capabilities)
    container.bind(CLIENT_INFO).toConstantValue(params.clientInfo ?? { name: '' })

    disposables.push(
      container.get(ConfigurationService).register(),
      container.get(DocumentService).register(),
      container.get(DictionaryService).register(),
      container.get(GrammarlyDiagnosticsService).register(),
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
