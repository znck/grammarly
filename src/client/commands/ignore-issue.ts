import { getClient } from '@/client'
import { commands } from 'vscode'
import { Disposable } from 'vscode-languageclient'

export function registerIgnoreWordCommand(): Disposable {
  return commands.registerCommand('grammarly.ignoreIssue', (...args) => {
    const client = getClient()
    client.sendNotification('command:grammarly.ignoreIssue', args)
  })
}
