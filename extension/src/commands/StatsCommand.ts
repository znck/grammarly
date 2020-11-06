import { injectable } from 'inversify'
import { commands, window } from 'vscode'
import { GrammarlyClient } from '../client'
import { Registerable } from '../interfaces'
import { capitalize } from '../utils/string'

@injectable()
export class StatsCommand implements Registerable {
  constructor(private readonly client: GrammarlyClient) {}

  register() {
    return commands.registerCommand('grammarly.stats', this.execute.bind(this))
  }

  private async execute() {
    if (!this.client.isReady()) return

    if (!window.activeTextEditor) {
      window.showInformationMessage('No active text document found.')

      return
    }

    const document = window.activeTextEditor.document

    if (this.client.isIgnoredDocument(document.uri.toString(), document.languageId)) {
      const ext = document.fileName.substr(document.fileName.lastIndexOf('.'))
      window.showInformationMessage(`The ${ext} filetype is not supported.`)
      // TODO: Add a button to create github issue.
      return
    }

    try {
      const uri = document.uri.toString()
      const state = await this.client.getDocumentState(uri)

      if (state == null || !('status' in state)) return

      const { score, textInfo, emotions, scores } = state

      const scoresMessages = Array.from(Object.entries(scores)).map(([key, value]) => `${key} ${~~(value! * 100)}`)

      await window.showInformationMessage(
        `
        Text Score: ${score} out of 100.  
        This score represents the quality of writing in this document. ${
          score < 100 ? `You can increase it by addressing Grammarly's suggestions.` : ''
        } 
        
        ${
          textInfo != null
            ? `${textInfo.wordsCount} words
        ${textInfo.charsCount} characters
        ${calculateTime(textInfo.wordsCount, 250)} reading time
        ${calculateTime(textInfo.wordsCount, 130)} speaking time
        ${textInfo.readabilityScore} readability score`
            : ''
        }

        
        ${scoresMessages.length ? scoresMessages.join('\n') : ''}

        ${
          emotions.length
            ? [
                `Here’s how your text sounds:\n`,
                emotions
                  .map((emotion) => `${emotion.emoji} ${capitalize(emotion.name)} ${~~(emotion.confidence * 100)}%\n`)
                  .join('\n'),
              ].join('\n')
            : ''
        }

        `.replace(/^[ \t]+/gm, ''),
        { modal: true },
      )
    } catch (error) {
      window.showErrorMessage(`Grammarly: ${error.message}`)
      // TODO: Add report url.
    }
  }
}

function calculateTime(words: number, wordsPerMinute: number) {
  const wordsPerSecond = wordsPerMinute / 60
  const time = secondsToTime(words / wordsPerSecond)

  return time
}

function secondsToTime(sec: number) {
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor((sec - hours * 3600) / 60)
  let seconds = sec - hours * 3600 - minutes * 60

  seconds = hours > 0 || minutes > 10 ? 0 : Math.floor(seconds)

  return [
    hours ? `${hours} ${choose(hours, 'hr', 'hrs')}` : '',
    minutes ? `${minutes} ${choose(minutes, 'min', 'mins')}` : '',
    seconds ? `${seconds} ${choose(seconds, 'sec', 'secs')}` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function choose(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural
}
