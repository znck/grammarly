import { createHandler, GrammarlyServerAPI } from '@/protocol'
import createDebugger from 'debug'
// @ts-ignore
import toMarkdown from 'html-to-md'
import { CodeAction, CodeActionParams, Connection, Hover, HoverParams } from 'vscode-languageserver'
import { getGrammarlyDocument, getTextDocument } from './documents'
import {
  createAddToDictionaryFix,
  createGrammarlyFix,
  createGrammarlySynonymFix,
  createIgnoreFix,
  getRangeInDocument,
  isSpellingAlert,
} from './helpers'
import { isIgnoredDocument } from './settings'
import { init } from '@/shared/credentialsStore'
import { inMemoryKeyChain } from '@/shared/inMemoryKeyChain'

const debug = createDebugger('grammarly:server')

export async function onCodeAction(connection: Connection, { range, textDocument, context }: CodeActionParams) {
  if (await isIgnoredDocument(textDocument.uri)) return

  const actions: CodeAction[] = []

  const folders = await connection.workspace.getWorkspaceFolders()
  const document = await getTextDocument(textDocument.uri)!
  const grammarly = await getGrammarlyDocument(textDocument.uri)
  const isWorkspace = !!folders && folders.length > 1
  const isAuthenticated = grammarly.document.isAuthenticated

  debug('onCodeAction', {
    textDocument,
    diagnostics: context.diagnostics,
  })

  context.diagnostics
    .map(({ code }) => grammarly.alerts[code as number])
    .forEach(alert => {
      if (alert) {
        debug('Add code action', {
          alert,
        })

        alert.replacements.map(replacement => actions.push(createGrammarlyFix(alert, replacement, document)))

        actions.push(createIgnoreFix(document, alert))

        if (isSpellingAlert(alert)) {
          actions.push(createAddToDictionaryFix(document, alert, 'user'))
          actions.push(createAddToDictionaryFix(document, alert, 'folder'))
          if (isWorkspace) actions.push(createAddToDictionaryFix(document, alert, 'workspace'))
          if (isAuthenticated) actions.push(createAddToDictionaryFix(document, alert, 'Grammarly'))
        }
      }
    })

  const word = document.getText(range)

  if (word && /^[a-z]+$/.test(word)) {
    const synonyms = await grammarly.findSynonyms(document.offsetAt(range.start), word)

    synonyms.forEach(meaning => {
      meaning.synonyms.forEach(replacement => {
        actions.push(createGrammarlySynonymFix(word, replacement, document, range))
      })
    })
  }

  return actions
}

export async function onHover({ position, textDocument }: HoverParams) {
  const document = await getTextDocument(textDocument.uri)
  const grammarly = await getGrammarlyDocument(textDocument.uri)

  const offset = document.offsetAt(position)
  const alerts = Object.values(grammarly.alerts).filter(
    alert => alert.highlightBegin <= offset && offset <= alert.highlightEnd
  )

  if (!alerts.length) return

  alerts.sort((a, b) => a.highlightEnd - a.highlightBegin - (b.highlightEnd - b.highlightBegin))

  const alert = alerts[0]

  const hover: Hover = {
    range: getRangeInDocument(document, alert.highlightBegin, alert.highlightEnd),
    contents: {
      kind: 'markdown',
      value:
        alert.explanation || alert.details || alert.examples
          ? toMarkdown(`${alert.explanation || ''} ${alert.details || ''} ${alert.examples || ''}`)
          : '',
    },
  }

  return hover
}

export function setProviderConnection(connection: Connection) {
  createHandler<GrammarlyServerAPI>({
    async addToDictionary(resource, { alertId }) {
      const grammarly = await getGrammarlyDocument(resource)

      await grammarly.document.addToDictionary(alertId)
    },
    async check(resource) {
      const grammarly = await getGrammarlyDocument(resource)

      await grammarly.document.refresh()
    },
    async dismissAlert(resource, alertId) {
      const grammarly = await getGrammarlyDocument(resource)

      await grammarly.document.dismissAlert(alertId)
    },
    async getStatistics(resource) {
      const grammarly = await getGrammarlyDocument(resource)
      const response = await grammarly.document.getTextStats()

      return {
        performance: {
          score: grammarly.generalScore,
        },
        content: {
          characters: response.chars,
          words: response.words,
          sentences: response.sentences,

          readingTime: calculateTime(response.words, 250),
          speakingTime: calculateTime(response.words, 130),
        },
        readability: {
          message: response.readabilityDescription,
          score: response.readabilityScore,

          wordLength: response.wordLength,
          sentenceLength: response.sentenceLength,
        },
        vocubulary: {
          rareWords: response.rareWords,
          uniqueWords: response.uniqueWords,
        },
      }
    },
    async getSummary(resource) {
      const grammarly = await getGrammarlyDocument(resource)

      return {
        overall: grammarly.generalScore,
        scores: grammarly.scores,
      }
    },
    async setCredentials(account: string, password: string) {
      init(inMemoryKeyChain({[account]: password}))
    }
  }).listen(connection)
}

function calculateTime(words: number, wordsPerMinute: number) {
  const _ = words / wordsPerMinute
  const hours = Math.floor(_ / 60)
  const seconds = Math.floor((_ * 60) % 60)
  const minutes = Math.floor(_ % 60)

  const hours_str = `${hours} hr`
  const minutes_str = `${minutes} min`
  const seconds_str = `${seconds} sec`

  return [hours > 0 ? hours_str : '', minutes > 0 ? minutes_str : '', seconds > 0 && hours === 0 ? seconds_str : '']
    .join(' ')
    .trim()
}
