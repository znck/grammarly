import createLogger from 'debug'
// @ts-ignore
import toMarkdown from 'html-to-md'
import {
  CodeAction,
  createConnection,
  Diagnostic,
  Hover,
  InitializeResult,
  ProposedFeatures,
  Range,
  TextDocument,
  TextDocuments,
} from 'vscode-languageserver'
import { DiagnosticSeverity } from 'vscode-languageserver-protocol'
import { Grammarly } from './grammarly'
import { AuthParams } from './socket'

process.env.DEBUG = 'grammarly:*'

const debug = createLogger('grammarly:server')
const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(2 /* TextDocumentSyncKind.Incremental */)

let hasConfigurationCapability: boolean = false
let hasWorkspaceFolderCapability: boolean = false
let hasDiagnosticRelatedInformationCapability: boolean = false

connection.onInitialize(
  (params): InitializeResult => {
    const capabilities = params.capabilities

    // Does the client support the `workspace/configuration` request?
    // If not, we will fall back using global settings.
    hasConfigurationCapability = !!(capabilities.workspace && capabilities.workspace.configuration)
    hasWorkspaceFolderCapability = !!(capabilities.workspace && capabilities.workspace.workspaceFolders)
    hasDiagnosticRelatedInformationCapability = !!(
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

connection.onInitialized(() => {
  debug('Server Ready.')
})

export interface GrammarlySettings {
  username: string | undefined
  password: string | undefined
  dialect: Grammarly.Dialect
}

const DEFAULT_SETTINGS: GrammarlySettings = {
  username: undefined,
  password: undefined,
  dialect: Grammarly.Dialect.AMERICAN,
}

const globalSettings = { ...DEFAULT_SETTINGS }
const documentSettings = new Map<string, Promise<GrammarlySettings>>()

connection.onDidChangeConfiguration(change => {
  if (hasConfigurationCapability) {
    documentSettings.clear()
  } else {
    Object.assign(globalSettings, change.settings.grammarly)
  }

  // TODO: Check all documents again.
})

const grammarlyDocuments = new Map<string, GrammarlyDocumentMeta>()

interface GrammarlyDocumentMeta {
  alerts: Record<number, Grammarly.Alert>
  synonyms: Record<string, Grammarly.TokenMeaning[]>
  document: Grammarly.DocumentHost
}

async function getGrammarlyDocument(document: TextDocument) {
  if (!grammarlyDocuments.has(document.uri)) {
    const settings = globalSettings
    const params: AuthParams = (settings.password && settings.username ? settings : undefined) as AuthParams
    const host = new Grammarly.DocumentHost(document, await getDocumentSettings(document.uri), params)
    const instance: GrammarlyDocumentMeta = {
      alerts: {},
      synonyms: {},
      document: host,
    }

    host
      .on(Grammarly.Action.ALERT, alert => {
        instance.alerts[alert.id] = alert
      })
      .on(Grammarly.Action.REMOVE, remove => {
        delete instance.alerts[remove.id]
        sendDiagnostics(document)
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

    context.diagnostics
      .map(({ code }) => grammarly.alerts[code as number])
      .forEach(alert => {
        if (alert)
          alert.replacements.map(replacement =>
            actions.push({
              title: `${alert.todo} -> ${replacement}`.replace(/^[a-z]/, m => m.toLocaleUpperCase()),
              kind: 'quickfix' /* CodeActionKind.QuickFix */,
              diagnostics: [createDiagnostic(alert, document)],
              edit: {
                changes: {
                  [document.uri]: [
                    {
                      range: getRangeInDocument(document, alert.begin, alert.end),
                      newText: replacement,
                    },
                  ],
                },
              },
            })
          )
      })

    const word = document.getText(range)

    if (word) {
      await Promise.race([
        grammarly.document.synonyms(document.offsetAt(range.start), word),
        new Promise(resolve => setTimeout(resolve, 1000)),
      ])

      if (word in grammarly.synonyms) {
        grammarly.synonyms[word].forEach(meaning => {
          meaning.synonyms.forEach(replacement => {
            const newText = replacement.derived

            actions.push({
              title: `${word} -> ${newText}`,
              kind: 'quickfix' /* CodeActionKind.QuickFix */,
              edit: {
                changes: {
                  [document.uri]: [
                    {
                      range,
                      newText,
                    },
                  ],
                },
              },
            })
          })
        })
      }
    }

    return actions
  })
)

function capturePromiseErrors<T extends Function>(fn: T, fallback?: unknown): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args)
    } catch (error) {
      console.error(error)
      return fallback
    }
  }) as any
}

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

connection.onNotification(async (command, uri) => {
  const document = documents.get(uri)

  if (!document) return
  if (command === 'grammarly.check') {
    const grammarly = await getGrammarlyDocument(document)

    grammarly.document.refresh()
  }
})

async function getDocumentSettings(resource: string): Promise<GrammarlySettings> {
  if (!hasConfigurationCapability) {
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

function createDiagnostic(alert: Grammarly.Alert, document: TextDocument) {
  const diagnostic: Diagnostic = {
    severity: getAlertSeverity(alert),
    message: (alert.title || alert.categoryHuman!).replace(/<\/?[^>]+(>|$)/g, ''),
    source: 'Grammarly',
    code: alert.id,
    range: getRangeInDocument(document, alert.begin, alert.end),
  }

  debug({
    id: alert.id,
    kind: diagnostic.severity,
    title: diagnostic.message,
    alert,
    diagnostic,
  })

  if (hasDiagnosticRelatedInformationCapability) {
    if (shouldIncludeAdditionalInformation(alert)) {
      diagnostic.relatedInformation = [
        {
          location: {
            uri: document.uri,
            range: getRangeInDocument(document, alert.highlightBegin, alert.highlightEnd),
          },
          message: alert.highlightText!,
        },
      ]
    }
  }

  return diagnostic
}

function shouldIncludeAdditionalInformation(alert: Grammarly.Alert): boolean {
  return !!(alert.highlightText && alert.highlightText.length <= 60)
}

function getAlertSeverity(alert: Grammarly.Alert): DiagnosticSeverity {
  switch (alert.category) {
    case 'WordChoice':
    case 'PassiveVoice':
    case 'Readability':
      return 3 /* DiagnosticSeverity.Information */
    case 'Clarity':
    case 'Dialects':
      return 2 /* DiagnosticSeverity.Warning */
    default:
      return 1 /* DiagnosticSeverity.Error */
  }
}

function getRangeInDocument(document: TextDocument, start: number, end: number): Range {
  return {
    start: document.positionAt(start),
    end: document.positionAt(end),
  }
}

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
