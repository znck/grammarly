import { getGrammarlyClient } from '@/client'
import { commands, ConfigurationTarget, Uri, workspace } from 'vscode'
import { Disposable } from 'vscode-languageclient'

export function registerAddWordCommand(): Disposable {
  return commands.registerCommand(
    'grammarly.addWord',
    async (target: 'grammarly' | 'workspace' | 'folder' | 'user', documentURI: string, code: number, word: string) => {
      const client = getGrammarlyClient()

      switch (target) {
        case 'folder':
          await addToFolderDictionary(documentURI, word)
          break

        case 'workspace':
          await addToWorkspaceDictionary(documentURI, word)
          break

        case 'user':
          await addToUserDictionary(word)
          break

        case 'grammarly':
          await client.addToDictionary(documentURI, { dictionary: 'grammarly', alertId: code, word })
          break
      }

      if (target !== 'grammarly') {
        await client.dismissAlert(documentURI, code)
      }
    }
  )
}

async function addToUserDictionary(word: string) {
  const config = workspace.getConfiguration('grammarly')
  const words = config.get<string[]>('userWords') || []

  words.sort()

  if (!words.includes(word)) {
    await config.update('userWords', words, ConfigurationTarget.Global)
  }
}

async function addToFolderDictionary(uri: string, word: string) {
  const config = workspace.getConfiguration('grammarly', Uri.parse(uri))
  const words = config.get<string[]>('userWords') || []

  words.sort()

  if (!words.includes(word)) {
    await config.update('userWords', words, ConfigurationTarget.WorkspaceFolder)
  }
}

async function addToWorkspaceDictionary(uri: string, word: string) {
  const config = workspace.getConfiguration('grammarly', Uri.parse(uri))
  const words = config.get<string[]>('userWords') || []

  words.sort()

  if (!words.includes(word)) {
    await config.update('userWords', words, ConfigurationTarget.Workspace)
  }
}
