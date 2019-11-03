import * as vscode from 'vscode'
import { LanguageClient, ServerOptions, TransportKind, LanguageClientOptions } from 'vscode-languageclient'

let client: LanguageClient | null = null
export async function activate(context: vscode.ExtensionContext) {
  const module = context.asAbsolutePath('out/server.js')
  const serverOptions: ServerOptions = {
    run: {
      module,
      transport: TransportKind.ipc,
    },
    debug: {
      module,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect=6009'],
      },
    },
  }
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      {
        scheme: 'file',
        language: 'plaintext',
      },
      {
        scheme: 'untitled',
        language: 'plaintext',
      },
      {
        scheme: 'file',
        language: 'markdown',
      },
      {
        scheme: 'untitled',
        language: 'markdown',
      },
    ],
    synchronize: {
      configurationSection: 'grammarly',
    },
  }

  client = new LanguageClient('grammarly', 'Grammarly', serverOptions, clientOptions)

  client.start()
  console.log('Welcome to "Grammarly" extension.')
  vscode.commands.registerCommand('grammarly.resolve', (id, uri) => {
    if (client) client.sendNotification('grammarly.resolve', [id, uri])
  })
}

export async function deactivate() {
  if (client) {
    await client.stop()
  }
}
