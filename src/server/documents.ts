import { sendCustomEventToClient } from '@/shared/events'
import { Grammarly } from '@/shared/grammarly'
import { Connection, TextDocument, TextDocuments } from 'vscode-languageserver'
import { isKnownWord } from './dictionary'
import { createDiagnostic, isSpellingAlert } from './helpers'
import { getAuthParams, getDocumentSettings, removeDocumentSetting, isIgnoredDocument } from './settings'

export interface GrammarlyDocument {
  alerts: Record<number, Grammarly.Alert>
  synonyms: Record<string, Grammarly.TokenMeaning[]>
  document: Grammarly.DocumentHost
  generalScore: number
  scores: Grammarly.FinishedResponse['outcomeScores']
  findSynonyms(offsetStart: number, word: string): Promise<Grammarly.TokenMeaning[]>
}

export const env = {
  hasConfigurationCapability: false,
  hasWorkspaceFolderCapability: false,
  hasDiagnosticRelatedInformationCapability: false,
}

export const documents = new TextDocuments(2 /* TextDocumentSyncKind.Incremental */)
export const grammarlyDocuments = new Map<string, GrammarlyDocument>()

let connection: Connection

export function setDocumentsConnection(conn: Connection) {
  documents.onDidClose(e => {
    removeDocumentSetting(e.document.uri)

    if (grammarlyDocuments.has(e.document.uri)) {
      const grammarly = grammarlyDocuments.get(e.document.uri)!

      grammarly.document.dispose()
      grammarlyDocuments.delete(e.document.uri)
    }
  })

  documents.onDidOpen(async e => {
    if (!(await isIgnoredDocument(e.document.uri))) {
      getGrammarlyDocument(e.document.uri)
    }
  })

  connection = patchConnection(conn)

  documents.listen(connection)
}

export class DocumentNotFoundException extends Error {
  constructor(public readonly uri: string, message: string = 'DocumentNotFound') {
    super(message)
  }
}

export async function getTextDocument(uri: TextDocument['uri']) {
  const document = documents.get(uri)

  if (document) return document

  throw new DocumentNotFoundException(uri)
}

export async function getGrammarlyDocument(uri: TextDocument['uri']) {
  return getOrCreateGrammarlyDocument(await getTextDocument(uri))
}

async function getOrCreateGrammarlyDocument(document: TextDocument) {
  if (!grammarlyDocuments.has(document.uri)) {
    grammarlyDocuments.set(document.uri, await createGrammarlyDocument(document))
  }

  return grammarlyDocuments.get(document.uri)!
}

async function createGrammarlyDocument(document: TextDocument) {
  const settings = await getDocumentSettings(document.uri)
  const host = new Grammarly.DocumentHost(document, settings, getAuthParams())
  const instance: GrammarlyDocument = {
    alerts: {},
    synonyms: {},
    document: host,
    generalScore: 0,
    scores: {
      Clarity: 0,
      Correctness: 0,
      Engagement: 0,
      GeneralScore: 0,
      Tone: 0,
    },
    findSynonyms: async (offsetStart: number, word: string) =>
      word in instance.synonyms ? instance.synonyms[word] : (await host.synonyms(offsetStart, word)).synonyms.meanings,
  }

  host
    .on(Grammarly.Action.ALERT, async alert => {
      instance.alerts[alert.id] = alert

      if (isSpellingAlert(alert)) {
        const word = alert.text
        if (await isKnownWord(word)) {
          host.dismissAlert(alert.id)
        }
      }

      if (alert.hidden) {
        host.dismissAlert(alert.id)
      }
    })
    .on(Grammarly.Action.REMOVE, remove => {
      if (remove.id in instance.alerts) {
        delete instance.alerts[remove.id]
        sendDiagnostics(document)
      }
    })
    .on(Grammarly.Action.SYNONYMS, result => {
      instance.synonyms[result.token] = result.synonyms.meanings
    })
    .on(Grammarly.Action.FEEDBACK, result => {
      instance.scores = {
        ...result.scores,
      }

      const scores = Object.values(result.scores)

      if (scores.every(score => score === 1)) {
        instance.alerts = {}
        instance.generalScore = 100
        sendDiagnostics(document)
      }

      sendCustomEventToClient(connection, Grammarly.Action.FEEDBACK, [document.uri, result])
    })
    .on(Grammarly.Action.FINISHED, result => {
      instance.generalScore = result.generalScore
      instance.scores = { ...result.outcomeScores }
      sendDiagnostics(document)
      sendCustomEventToClient(connection, Grammarly.Action.FINISHED, [document.uri, result])
    })

  return instance
}

async function sendDiagnostics(document: TextDocument) {
  const grammarly = await getGrammarlyDocument(document.uri)

  connection.sendDiagnostics({
    version: document.version,
    uri: document.uri,
    diagnostics: Object.values(grammarly.alerts)
      .filter(alert => alert.hidden !== true)
      .map(alert => createDiagnostic(alert, document)),
  })
}

function patchConnection(connection: Connection) {
  let applyTextDocumentChange: Function
  const onDidChangeTextDocument = connection.onDidChangeTextDocument
  connection.onDidChangeTextDocument = fn => {
    applyTextDocumentChange = fn
  }
  onDidChangeTextDocument(e => {
    const uri = e.textDocument.uri
    const prevContent = documents.get(uri) ? documents.get(uri)!.getText() : ''
    applyTextDocumentChange(e)

    if (e.contentChanges.length && grammarlyDocuments.has(uri)) {
      const document = documents.get(uri)!
      const grammarly = grammarlyDocuments.get(uri)!
      const change = e.contentChanges[e.contentChanges.length - 1]

      if (change.range) {
        const offsetStart = document.offsetAt(change.range.start)
        const offsetEnd = document.offsetAt(change.range.end)
        const deleteLength = change.rangeLength!
        const insertLength = change.text.length
        const changeLength = insertLength - deleteLength

        Object.values(grammarly.alerts).forEach(alert => {
          if (alert.highlightEnd < offsetStart) return
          if (offsetStart <= alert.highlightBegin && alert.highlightBegin <= offsetEnd) {
            delete grammarly.alerts[alert.id]
            return
          }

          alert.begin += changeLength
          alert.end += changeLength
          alert.highlightBegin += changeLength
          alert.highlightEnd += changeLength
        })

        if (change.text.length) {
          if (deleteLength) {
            grammarly.document.delete(prevContent.length, deleteLength, offsetStart)
          }

          grammarly.document.insert(prevContent.length - deleteLength, change.text, offsetStart)
        } else {
          grammarly.document.delete(prevContent.length, deleteLength, offsetStart)
        }
      } else {
        grammarly.document.refresh()
        grammarly.alerts = {}
        grammarly.synonyms = {}
      }
    }
  })

  return connection
}
