import { Grammarly } from '@/shared/grammarly'
import { commands, window } from 'vscode'
import { Disposable } from 'vscode-languageclient'
import { getClient } from '..'
import { isIgnoredDocument } from '../utils'

export function registerStatsCommand(): Disposable {
  return commands.registerCommand('grammarly.stats', async () => {
    const { activeTextEditor } = window
    if (!activeTextEditor) return

    const { document } = activeTextEditor
    if (isIgnoredDocument(document)) return

    const client = getClient()

    try {
      const result = await client.sendRequest<Grammarly.StatsResponse>(
        '$/grammarly/' + Grammarly.Action.STATS,
        document.uri.toString()
      )

      console.log('got response...', result)

      await window.showInformationMessage(
        `
        Word Count:
        
        Characters ${result.chars}
        Words ${result.words}
        Sentences ${result.sentences}


        Readability:

        Word Length ${result.wordLength} (${result.wordLengthIndex}%)
        Sentence Length ${result.sentenceLength} (${result.sentenceLengthIndex}%)
        Readability Score ${result.readabilityScore}

        ${result.readabilityDescription}
        `.replace(/^[ \t]+/gm, ''),
        { modal: true }
      )
    } catch (error) {
      console.error(error)
    }
  })
}
