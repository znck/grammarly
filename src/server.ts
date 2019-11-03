import {
  createConnection,
  DidChangeConfigurationNotification,
  InitializeResult,
  ProposedFeatures,
  TextDocument,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  Range,
  CodeAction,
  CodeActionKind,
  Command,
  Hover,
} from 'vscode-languageserver'
import TurndownService from 'turndown'
import throttle from 'lodash.throttle'

import { Grammarly } from '@stewartmcgown/grammarly-api'
import { ProblemResponse } from '@stewartmcgown/grammarly-api/build/lib/responses'
import { GrammarlyResult } from '@stewartmcgown/grammarly-api/build/lib/api'

const turndown = new TurndownService()
const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments()

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
        textDocumentSync: documents.syncKind,
        completionProvider: {
          resolveProvider: true,
        },
        codeActionProvider: true,
        hoverProvider: true,
      },
    }
  }
)

connection.onInitialized(() => {
  connection.console.log('Server Ready.')
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined)
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(event => {
      connection.console.log('Workspace folder change event received.')
    })
  }
})

interface GrammarlySettings {
  enabled: boolean
  username: string | undefined
  password: string | undefined
  auth?: {
    grauth: string
    'csrf-token': string
  }
}

const DEFAULT_SETTINGS: GrammarlySettings = {
  enabled: true,
  username: undefined,
  password: undefined,
}

const globalSettings = { ...DEFAULT_SETTINGS }
const documentSettings = new Map<string, Promise<GrammarlySettings>>()

connection.onDidChangeConfiguration(change => {
  if (hasConfigurationCapability) {
    documentSettings.clear()
  } else {
    Object.assign(globalSettings, change.settings.grammarly)
  }

  documents.all().forEach(document => checkGrammar(document))
})

const cache = new Map<
  string,
  { content: string; analysis: Promise<GrammarlyResult>; isDone: boolean; queue: Function[] }
>()
async function getGrammarlyAnalysisUsing(
  grammarly: Grammarly,
  id: string,
  content: string,
  onFreshAnalysis?: (result: GrammarlyResult) => void
) {
  const refresh = () => {
    const analysis = grammarly.analyse(content)

    cache.set(id, { content, analysis, isDone: false, queue: [] })

    return analysis
      .then(result => {
        cache.set(id, { ...cache.get(id)!, isDone: true })

        if (onFreshAnalysis) onFreshAnalysis(result)

        return result
      })
      .catch(e => {
        if (e.error === 'not_authorized')
          return getGrammarlyAnalysisUsing(new Grammarly(), id, content, onFreshAnalysis)
      })
  }
  if (cache.has(id)) {
    const prev = cache.get(id)!

    if (prev.content !== content) {
      if (prev.isDone) refresh()
      else prev.queue = [refresh]
    }

    return prev.analysis
  } else {
    refresh()
  }

  return cache.get(id)!.analysis
}

async function getGrammarlyAnalysis(document: TextDocument, onFreshAnalysis?: (result: GrammarlyResult) => void) {
  const settings = await getDocumentSettings(document.uri)
  if (!settings.enabled) return

  const grammarly = getGrammarlyClient(document.uri, settings)

  return await getGrammarlyAnalysisUsing(grammarly, document.uri, document.getText(), onFreshAnalysis)
}

connection.onCodeAction(async ({ range, textDocument }) => {
  const document = documents.get(textDocument.uri)
  if (!document) return
  const results = await getGrammarlyAnalysis(document)
  if (!results) return

  const actions: CodeAction[] = []
  const offsetStart = document.offsetAt(range.start)
  const offsetEnd = document.offsetAt(range.end)

  const alerts = results.alerts.filter(alert => alert.highlightBegin <= offsetEnd && offsetStart <= alert.highlightEnd)

  alerts.forEach(alert => {
    alert.replacements.map(replacement =>
      actions.push({
        title: `${alert.todo} -> ${replacement}`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [createDiagnostic(alert, document)],
        command: Command.create('Apply fix', 'grammarly.resolve', alert.id, document.uri),
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

  return actions
})

connection.onHover(async ({ position, textDocument }) => {
  const document = documents.get(textDocument.uri)
  if (!document) return
  const results = await getGrammarlyAnalysis(document)
  if (!results) return

  const offset = document.offsetAt(position)
  const alerts = results.alerts.filter(alert => alert.highlightBegin <= offset && offset <= alert.highlightEnd)

  if (!alerts.length) return

  alerts.sort((a, b) => a.highlightEnd - a.highlightBegin - (b.highlightEnd - b.highlightBegin))

  const alert = alerts[0]

  const hover: Hover = {
    range: getRangeInDocument(document, alert.highlightBegin, alert.highlightEnd),
    contents: {
      kind: 'markdown',
      value:
        alert.explanation || alert.details || alert.examples
          ? turndown.turndown(`${alert.explanation || ''} ${alert.details || ''} ${alert.examples || ''}`)
          : '\n' + alert.cardLayout.outcomeDescription + '\n',
    },
  }

  return hover
})

connection.onNotification(async (command, id, uri) => {
  const document = documents.get(uri)
  if (!document) return

  if (command === 'grammarly.resolve') {
    const result = await getGrammarlyAnalysis(document, () => checkGrammar(document))
    if (!result) return

    const alert = result.alerts.find(alert => alert.id === id)
    if (!alert) return
    ;(alert as any).isResolved = true

    checkGrammar(document)
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
})

documents.onDidChangeContent(e => {
  console.log('File contents changed: ' + e.document.uri)
  getGrammarlyAnalysis(e.document, () => {
    console.log('Received diagnostics: ' + e.document.uri)
    checkGrammar(e.document)
  })
})

const grammarlyClients = new Map<string, Grammarly>()

function getGrammarlyClient(id: string, settings: GrammarlySettings) {
  if (!grammarlyClients.has(id)) {
    grammarlyClients.set(
      id,
      settings.auth && settings.auth.grauth && settings.auth["csrf-token"]
        ? new Grammarly({ auth: settings.auth })
        : settings.username && settings.password
        ? new Grammarly(settings)
        : new Grammarly()
    )
  }

  return grammarlyClients.get(id)!
}

async function checkGrammar(document: TextDocument) {
  const results = await getGrammarlyAnalysis(document)
  if (!results) return

  const diagnostics = results.alerts
    .filter(alert => !(alert as any).isResolved)
    .map(alert => createDiagnostic(alert, document))

  connection.sendDiagnostics({
    uri: document.uri,
    diagnostics,
  })
}

function createDiagnostic(alert: ProblemResponse, document: TextDocument) {
  const diagnostic: Diagnostic = {
    severity: getAlertSeverity(alert),
    message: (alert.title || alert.categoryHuman!).replace(/<\/?[^>]+(>|$)/g, ''),
    source: 'Grammarly',
    code: alert.id,
    range: getRangeInDocument(document, alert.begin, alert.end),
  }

  console.log({
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

function shouldIncludeAdditionalInformation(alert: ProblemResponse): boolean {
  return alert.highlightText.length <= 60
}

function getAlertSeverity(alert: ProblemResponse): DiagnosticSeverity {
  switch (alert.category) {
    case 'WordChoice':
    case 'PassiveVoice':
    case 'Readability':
      return DiagnosticSeverity.Information
    case 'Clarity':
    case 'Dialects':
      return DiagnosticSeverity.Warning
    default:
      return DiagnosticSeverity.Error
  }
}

function getRangeInDocument(document: TextDocument, start: number, end: number): Range {
  return {
    start: document.positionAt(start),
    end: document.positionAt(end),
  }
}

documents.listen(connection)
connection.listen()
