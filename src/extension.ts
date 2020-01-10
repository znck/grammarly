import * as vscode from 'vscode'
import { LanguageClient, ServerOptions, TransportKind, LanguageClientOptions } from 'vscode-languageclient'
import { GrammarlySettings } from './GrammarlySettings'
import { ConfigurationTarget } from 'vscode'
import { Uri } from 'vscode'

let client: LanguageClient | null = null
export async function activate(context: vscode.ExtensionContext) {
  const module = context.asAbsolutePath('out/server/index.js')
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
  const languages = ['plaintext', 'markdown', 'latex', 'restructuredtext', 'git-commit', 'git-rebase']
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      ...languages.map(language => ({ scheme: 'file', language })),
      ...languages.map(language => ({ scheme: 'untitled', language })),
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
        client.sendNotification('command:grammarly.check', [activeEditor.document.uri.toString()])
      }
    }),
    vscode.commands.registerCommand('grammarly.ignoreIssue', (...args) => {
      if (client) {
        client.sendNotification('command:grammarly.ignoreIssue', args)
      }
    }),

    vscode.commands.registerCommand(
      'grammarly.addWord',
      async (target: string, documentURI: string, code: number, word: string) => {
        if (client) {
          if (target === 'user' || target === 'folder' || target === 'workspace') {
            const config = vscode.workspace.getConfiguration().get<GrammarlySettings>('grammarly')

            const userWords = config ? config.userWords || [] : []

            if (!userWords.includes(word)) {
              userWords.push(word)
              userWords.sort()

              if (target === 'user') {
                await vscode.workspace
                  .getConfiguration()
                  .update('grammarly.userWords', userWords, ConfigurationTarget.Global)
              } else {
                await vscode.workspace
                  .getConfiguration(undefined, Uri.parse(documentURI))
                  .update(
                    'grammarly.userWords',
                    userWords,
                    target === 'folder' ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace
                  )
              }
            }
          }

          client.sendNotification('command:grammarly.addWord', [target, documentURI, code, word])
        }
      }
    )
  )
}

export async function deactivate() {
  if (client) {
    await client.stop()
  }
}
