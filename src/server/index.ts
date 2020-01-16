import createLogger from 'debug'
import { createConnection, InitializeResult, ProposedFeatures } from 'vscode-languageserver'
import { setDocumentsConnection } from './documents'
import { env } from './env'
import { capturePromiseErrors as voidOnError } from './helpers'
import { onCodeAction, onHover, setProviderConnection } from './providers'
import { onDidChangeConfiguration, setSettingsConnection } from './settings'

process.env.DEBUG = 'grammarly:*'

const debug = createLogger('grammarly:server')
const connection = createConnection(ProposedFeatures.all)

connection.onInitialize(
  (params): InitializeResult => {
    const capabilities = params.capabilities

    env.hasConfigurationCapability = !!(capabilities.workspace && capabilities.workspace.configuration)
    env.hasWorkspaceFolderCapability = !!(capabilities.workspace && capabilities.workspace.workspaceFolders)
    env.hasDiagnosticRelatedInformationCapability = !!(
      capabilities.textDocument &&
      capabilities.textDocument.publishDiagnostics &&
      capabilities.textDocument.publishDiagnostics.relatedInformation
    )

    return {
      capabilities: {
        textDocumentSync: 2 /* TextDocumentSyncKind.Incremental */,
        codeActionProvider: true,
        hoverProvider: true,
      },
    }
  }
)

setDocumentsConnection(connection)
setProviderConnection(connection)
setSettingsConnection(connection)

connection.onInitialized(() => debug('Server Ready.'))
connection.onDidChangeConfiguration(onDidChangeConfiguration)
connection.onCodeAction(voidOnError(params => onCodeAction(connection, params)))
connection.onHover(voidOnError(params => onHover(params)))

connection.listen()
