import { GrammarlySettings } from '@/settings'
import { ConfigurationTarget } from 'vscode'
import { Uri } from 'vscode'
import { getClient } from '@/client'
import { commands } from 'vscode'
import { workspace } from 'vscode'
import { Disposable } from 'vscode-languageclient'

export function registerAddWordCommand(): Disposable {
  return commands.registerCommand(
    'grammarly.addWord',
    async (target: string, documentURI: string, code: number, word: string) => {
      if (target === 'user' || target === 'folder' || target === 'workspace') {
        const config = workspace.getConfiguration().get<GrammarlySettings>('grammarly')
        const userWords = config ? config.userWords || [] : []
        if (!userWords.includes(word)) {
          userWords.push(word)
          userWords.sort()
          if (target === 'user') {
            await workspace.getConfiguration().update('grammarly.userWords', userWords, ConfigurationTarget.Global)
          } else {
            await workspace
              .getConfiguration(undefined, Uri.parse(documentURI))
              .update(
                'grammarly.userWords',
                userWords,
                target === 'folder' ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace
              )
          }
        }
      }
      const client = getClient()
      client.sendNotification('command:grammarly.addWord', [target, documentURI, code, word])
    }
  )
}
