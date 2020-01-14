import { getGrammarlyClient } from '@/client'
import { isIgnoredDocument } from '@/client/utils'
import { commands, window } from 'vscode'
import { Disposable } from 'vscode-languageclient'

export function registerCheckCommand(): Disposable {
  return commands.registerCommand('grammarly.check', async () => {
    if (!window.activeTextEditor) return
    const document = window.activeTextEditor.document
    if (isIgnoredDocument(document)) return

    await getGrammarlyClient().check(document.uri.toString())
  })
}
