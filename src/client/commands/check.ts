import { getClient } from '@/client'
import { commands, Uri, window } from 'vscode'
import { Disposable } from 'vscode-languageclient'

export function registerCheckCommand(): Disposable {
  return commands.registerCommand('grammarly.check', () => {
    if (!window.activeTextEditor) return
    executeCheckCommand(window.activeTextEditor.document.uri)
  })
}

export function executeCheckCommand(uri: Uri) {
  const client = getClient()

  client.sendNotification('command:grammarly.check', [uri.toString()])
}
