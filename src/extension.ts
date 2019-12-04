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
      {
        scheme: 'file',
        language: 'latex',
      },
      {
        scheme: 'untitled',
        language: 'latex',
      },
      {
        scheme: 'file',
        language: 'asciidoc',
      },
      {
        scheme: 'untitled',
        language: 'asciidoc',
      },
    ],
    synchronize: {
      configurationSection: 'grammarly',
    },
  }

  client = new LanguageClient('grammarly', 'Grammarly', serverOptions, clientOptions)

  client.start()

  console.log('Welcome to "Grammarly" extension.')

  context.subscriptions.push(
    vscode.commands.registerCommand('grammarly.check', () => {
      const activeEditor = vscode.window.activeTextEditor
      if (!activeEditor) return
      if (client) {
        client.sendNotification('grammarly.check', [activeEditor.document.uri])
      }
    })
  )
}

export async function deactivate() {
  if (client) {
    await client.stop()
  }
}
