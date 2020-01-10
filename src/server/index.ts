import createLogger from 'debug'
// @ts-ignore
import toMarkdown from 'html-to-md'
import {
  CodeAction,
  createConnection,
  Hover,
  InitializeResult,
  ProposedFeatures,
  Range,
  TextDocument,
  TextDocuments,
} from 'vscode-languageserver'
import { Grammarly } from '../grammarly'
import { DEFAULT_SETTINGS, GrammarlySettings } from '../GrammarlySettings'
import { AuthParams } from '../socket'
import { env, GrammarlyDocumentMeta } from './GrammarlyDocumentMeta'
import {
  capturePromiseErrors,
  createAddToDictionaryFix,
  createGrammarlyFix,
  createGrammarlySynonymFix,
  isSpellingAlert,
  createDiagnostic,
} from './helpers'

process.env.DEBUG = 'grammarly:*'

const debug = createLogger('grammarly:server')
const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(2 /* TextDocumentSyncKind.Incremental */)

connection.onInitialize(
  (params): InitializeResult => {
    const capabilities = params.capabilities

    // Does the client support the `workspace/configuration` request?
    // If not, we will fall back using global settings.
    env.hasConfigurationCapability = !!(capabilities.workspace && capabilities.workspace.configuration)
    env.hasWorkspaceFolderCapability = !!(capabilities.workspace && capabilities.workspace.workspaceFolders)
    env.hasDiagnosticRelatedInformationCapability = !!(
      capabilities.textDocument &&
      capabilities.textDocument.publishDiagnostics &&
      capabilities.textDocument.publishDiagnostics.relatedInformation
    )

    return {
      capabilities: {
        textDocumentSync: 2 /* TextDocumentSyncKind.Incremental */,
        codeActionProvider: true,
        hoverProvider: true,
      },
    }
  }
)

const globalSettings = { ...DEFAULT_SETTINGS }
const documentSettings = new Map<string, Promise<GrammarlySettings>>()
const additionalWords: string[] = []

connection.onInitialized(async () => {
  debug('Server Ready.')

  if (env.hasConfigurationCapability) {
    const items = await connection.workspace.getConfiguration('cSpell.userWords')

    if (items) {
      additionalWords.push(...items)
    }
  }
})

connection.onDidChangeConfiguration(change => {
  if (env.hasConfigurationCapability) {
    documentSettings.clear()
  } else {
    Object.assign(globalSettings, change.settings.grammarly)
  }

  // TODO: Check all documents again.
})

const grammarlyDocuments = new Map<string, GrammarlyDocumentMeta>()
async function getGrammarlyDocument(document: TextDocument) {
  if (!grammarlyDocuments.has(document.uri)) {
    const documentSettings = await getDocumentSettings(document.uri)
    const params: AuthParams = (globalSettings.password && globalSettings.username
      ? globalSettings
      : undefined) as AuthParams
    const host = new Grammarly.DocumentHost(document, documentSettings, params)
    const instance: GrammarlyDocumentMeta = {
      alerts: {},
      synonyms: {},
      document: host,
    }
    const words = new Set([...additionalWords, ...globalSettings.userWords, ...documentSettings.userWords])

    host
      .on(Grammarly.Action.ALERT, alert => {
        if (isSpellingAlert(alert)) {
          const word = alert.text

          if (words.has(word) || words.has(word.toLocaleLowerCase())) {
            host.dismissAlert(alert.id)
          } else {
            instance.alerts[alert.id] = alert
          }
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
      .on(Grammarly.Action.FINISHED, () => sendDiagnostics(document))

    grammarlyDocuments.set(document.uri, instance)
  }

  return grammarlyDocuments.get(document.uri)!
}

async function sendDiagnostics(document: TextDocument) {
  const grammarly = await getGrammarlyDocument(document)

  connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: Object.values(grammarly.alerts).map(alert => createDiagnostic(alert, document)),
  })
}

connection.onCodeAction(
  capturePromiseErrors(async ({ range, textDocument, context }) => {
    const document = documents.get(textDocument.uri)
    if (!document) return
    const grammarly = await getGrammarlyDocument(document)
    const actions: CodeAction[] = []

    const folders = await connection.workspace.getWorkspaceFolders()
    const isWorkspace = !!folders && !!folders.length

    debug('Request code action', {
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

          if (isSpellingAlert(alert)) {
            actions.push(createAddToDictionaryFix(document, alert, 'user'))
            actions.push(createAddToDictionaryFix(document, alert, 'folder'))
            if (isWorkspace) actions.push(createAddToDictionaryFix(document, alert, 'workspace'))
            actions.push(createAddToDictionaryFix(document, alert, 'grammarly'))
          }
        }
      })

    const word = document.getText(range)

    if (word) {
      await Promise.race([
        grammarly.document.synonyms(document.offsetAt(range.start), word),
        new Promise(resolve => setTimeout(resolve, 5000)), // TODO: Maybe use a config.
      ])

      if (word in grammarly.synonyms) {
        grammarly.synonyms[word].forEach(meaning => {
          meaning.synonyms.forEach(replacement => {
            actions.push(createGrammarlySynonymFix(word, replacement, document, range))
          })
        })
      }
    }

    return actions
  })
)

connection.onHover(
  capturePromiseErrors(async ({ position, textDocument }) => {
    const document = documents.get(textDocument.uri)
    if (!document) return
    const grammarly = await getGrammarlyDocument(document)

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
  })
)

connection.onNotification(async (event, ...args: any[]) => {
  debug('Notification', { event, args })

  if (event.startsWith('command:')) {
    switch (event) {
      case 'command:grammarly.check':
        await executeCheckCommand(args[0])
        break
      case 'command:grammarly.addWord':
        await executeAddWordCommand(args[0], args[1], args[2])
        break
    }
  }
})

async function executeAddWordCommand(target: string, documentURI: string, code: number) {
  const document = documents.get(documentURI)
  if (document) {
    const grammarly = await getGrammarlyDocument(document)
    if (target === 'grammarly') {
      await grammarly.document.addToDictionary(code)
    } else {
      await grammarly.document.dismissAlert(code)
    }
  }
}

async function executeCheckCommand(documentURI: TextDocument['uri']) {
  const document = documents.get(documentURI)

  if (document) {
    const grammarly = await getGrammarlyDocument(document)

    grammarly.document.refresh()
  }
}

async function getDocumentSettings(resource: string): Promise<GrammarlySettings> {
  if (!env.hasConfigurationCapability) {
    return globalSettings
  }

  let result = documentSettings.get(resource)

  if (!result) {
    result = connection.workspace
      .getConfiguration({
        scopeUri: resource,
        section: 'grammarly',
      })
      .then(result => result || globalSettings) as Promise<GrammarlySettings>

    documentSettings.set(resource, result)
  }

  return result
}

documents.onDidClose(e => {
  documentSettings.delete(e.document.uri)
  if (grammarlyDocuments.has(e.document.uri)) {
    const grammarly = grammarlyDocuments.get(e.document.uri)!

    grammarly.document.dispose()
    grammarlyDocuments.delete(e.document.uri)
  }
})
documents.onDidOpen(e => {
  getGrammarlyDocument(e.document)
})

let applyTextDocumentChange: Function
const onDidChangeTextDocument = connection.onDidChangeTextDocument
connection.onDidChangeTextDocument = fn => {
  applyTextDocumentChange = fn
}
documents.listen(connection)
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

connection.listen()
