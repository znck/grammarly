import { inject, injectable } from 'inversify'
import {
  AlertEvent,
  IdAlert,
  IdRevision,
  rebaseTextRange,
  ResponseKind,
  TextChange,
  TextRange,
} from 'unofficial-grammarly-api'
import {
  CodeAction,
  CodeActionKind,
  Connection,
  Diagnostic,
  DiagnosticRelatedInformation,
  DiagnosticSeverity,
  DiagnosticTag,
  Disposable,
  MarkedString,
  ServerCapabilities,
} from 'vscode-languageserver'
import { Position } from 'vscode-languageserver-textdocument'
import { CONNECTION, SERVER } from '../constants'
import { DevLogger } from '../DevLogger'
import { GrammarlyDocument } from '../GrammarlyDocument'
import { Registerable } from '../interfaces'
import { isNumber } from '../is'
import { GrammarlyLanguageServer } from '../protocol'
import { watch, watchEffect } from '../watch'
import { ConfigurationService } from './ConfigurationService'
import { DocumentService } from './DocumentService'

interface DiagnosticWithPosition extends Diagnostic, TextRange {
  id: IdAlert
  rev: IdRevision
}

const SOURCE = 'Grammarly'

@injectable()
export class GrammarlyDiagnosticsService implements Registerable {
  private LOGGER = new DevLogger(GrammarlyDiagnosticsService.name)
  private diagnostics = new Map<string, Map<IdAlert, DiagnosticWithPosition[]>>()
  private histories = new Map<string, Array<{ rev: IdRevision; changes: TextChange[] }>>()

  constructor (
    @inject(CONNECTION)
    private readonly connection: Connection,

    @inject(SERVER)
    private readonly capabilities: ServerCapabilities,

    private readonly documents: DocumentService,

    private readonly config: ConfigurationService,
  ) { }

  public register() {
    this.capabilities.hoverProvider = true
    this.capabilities.codeActionProvider = true

    this.connection.onRequest(GrammarlyLanguageServer.Feature.checkGrammar, (ref) => {
      this.LOGGER.trace(`${GrammarlyLanguageServer.Feature.checkGrammar}(${JSON.stringify(ref, null, 2)})`)
      this.check(ref.uri)
    })

    this.connection.onRequest(GrammarlyLanguageServer.Feature.stop, (ref) => {
      this.LOGGER.trace(`${GrammarlyLanguageServer.Feature.stop}(${JSON.stringify(ref, null, 2)})`)
      const document = this.documents.get(ref.uri)

      if (document != null) {
        this.clearDiagnostics(document)
        this.connection.sendRequest(GrammarlyLanguageServer.Client.Feature.updateDocumentState, { uri: document.uri })
        document.detachHost()
      }
    })

    this.connection.onRequest(GrammarlyLanguageServer.Feature.getDocumentState, (ref) => {
      this.LOGGER.trace(`${GrammarlyLanguageServer.Feature.checkGrammar}(${JSON.stringify(ref, null, 2)})`)
      const document = this.documents.get(ref.uri)

      if (document?.host) {
        return this.getDocumentState(document)
      }

      return null
    })

    this.connection.onRequest(GrammarlyLanguageServer.Feature.acceptAlert, (options) => {
      this.LOGGER.trace(`${GrammarlyLanguageServer.Feature.acceptAlert}(${JSON.stringify(options, null, 2)})`)
      const document = this.documents.get(options.uri)
      this.diagnostics.get(options.uri)?.delete(options.id)
      if (document?.host) {
        document.host.acceptAlert(options.id, options.text)
        this.sendDiagnostics(document)
      }
    })

    this.documents.onDidOpen((document) => {
      if (document.host) {
        this.LOGGER.trace(`Listening Grammarly alerts for ${document.uri}`)
        this.setupDiagnostics(document)
      }
    })

    this.documents.onDidClose((document) => {
      this.LOGGER.trace(`Stopping Grammarly alerts for ${document.uri}`)
      this.clearDiagnostics(document)
    })

    this.connection.onHover(({ position, textDocument }) => {
      this.LOGGER.trace('Hover', `Incoming request for ${textDocument.uri} at`, position)
      const diagnostics = this.findDiagnosticsAt(textDocument.uri, position)
      this.LOGGER.debug('Hover', 'Active diagnostics at', diagnostics)
      const document = this.documents.get(textDocument.uri)!
      if (!diagnostics.length) return null

      const range = document.rangeAt(
        Math.min(...diagnostics.map((diagnostic) => diagnostic.start)),
        Math.max(...diagnostics.map((diagnostic) => diagnostic.end)),
      )

      const hover = {
        range: range,
        contents: [] as MarkedString[],
      }

      const config = {
        isDebugMode: this.config.settings.debug,
        showDetails: this.config.settings.showExplanation,
        showExamples: this.config.settings.showExamples,
        cta: document.host!.user.value.isAnonymous
          ? '> 👉 [Login](https://www.grammarly.com/login) to get automated fix for this issue.'
          : document.host!.user.value.isPremium
            ? ''
            : '> ⏫ [Upgrade](https://www.grammarly.com/upgrade) to get automated fix for this issue.',
      }

      unique(diagnostics.map((diagnostic) => diagnostic.id))
        .map((id) => document.host!.getAlert(id))
        .forEach((alert, index) => {
          if (!alert) return

          if (alert.title) {
            const hasFixes = alert.replacements.length
            hover.contents.push(
              toMarkdown(
                `#### ${alert.title}`,
                index === 0 ? (hasFixes ? `` : config.cta) : '',
                alert.explanation,
                config.showDetails && !alert.hidden ? alert.details : '',
                config.showExamples && !alert.hidden ? alert.examples : '',
              ),
            )
          } else if (alert.subalerts?.length) {
            const hasFixes = alert.subalerts.every((alert) => !!alert.transformJson.alternatives)
            const count = alert.subalerts.length
            hover.contents.push(
              toMarkdown(
                `### ${alert.cardLayout.outcome}`,
                index === 0 ? (hasFixes ? `` : config.cta) : '',
                alert.cardLayout.outcomeDescription,
                '<p></p>',
                `*There ${count > 1 ? 'are' : 'is'} ${count} such ${count > 1 ? 'issues' : 'issue'} in this document.*`,
              ),
            )
          } else {
            const hasFixes = alert.replacements.length
            hover.contents.push(
              toMarkdown(
                `### ${alert.cardLayout.outcome}`,
                index === 0 ? (hasFixes ? `` : config.cta) : '',
                alert.cardLayout.outcomeDescription,
              ),
            )
          }

          if (config.isDebugMode) {
            hover.contents.push({ value: JSON.stringify(alert, null, 2), language: 'json' })
          }
        })

      this.LOGGER.debug('Hover', 'Sending', hover)

      return hover
    })

    this.connection.onCodeAction(async ({ textDocument, context }) => {
      const document = this.documents.get(textDocument.uri)
      const diagnostics = context.diagnostics.filter((diagnostic) => diagnostic.source === SOURCE)
      this.LOGGER.trace(`CodeAction in ${textDocument.uri}`, diagnostics)
      const actions: CodeAction[] = []

      if (diagnostics.length >= 1 && document?.host) {
        const diagnostic = diagnostics[0]
        const alert = document.host.getAlert(diagnostic.code as IdAlert)

        if (alert && alert.replacements.length) {
          const range = rebaseTextRange(
            { start: alert.begin, end: alert.end },
            this.findChangesSinceRevision(document, alert.rev),
          )
          this.LOGGER.debug(
            'Changes since',
            alert.rev,
            this.findChangesSinceRevision(document, alert.rev),
            this.histories.get(document.uri),
          )
          const newRange = document.rangeAt(range.start, range.end)

          alert.replacements.forEach((newText) => {
            actions.push({
              title: alert.minicardTitle,
              kind: CodeActionKind.QuickFix,
              diagnostics: diagnostics,
              isPreferred: true,
              command: {
                command: 'grammarly.callback',
                title: '',
                arguments: [
                  {
                    method: GrammarlyLanguageServer.Feature.acceptAlert,
                    params: { id: alert.id, text: newText, uri: textDocument.uri },
                  },
                ],
              },
              edit: {
                changes: {
                  [textDocument.uri]: [
                    {
                      range: newRange,
                      newText: newText,
                    },
                  ],
                },
              },
            })
          })
        }
      }

      // TODO: Provide synonyms.

      this.LOGGER.debug('Providing code actions', actions)

      return actions
    })

    this.LOGGER.trace('Registering diagnostics service for Grammarly')

    return Disposable.create(() => { })
  }

  private findDiagnosticsAt(uri: string, position: Position) {
    const document = this.documents.get(uri)
    const diagnostics = this.diagnostics.get(uri)

    if (!document || !document.host || !diagnostics) {
      return []
    }

    const offset = document.offsetAt(position)

    return Array.from(diagnostics.values())
      .flat()
      .filter((diagnostic) => diagnostic.start <= offset && offset <= diagnostic.end)
  }

  private async check(uri: string) {
    const document = this.documents.get(uri)

    if (document) {
      // When host is attached onDidOpen callback would be called.
      await this.documents.attachHost(document, true)
    }
  }

  private setupDiagnostics(document: GrammarlyDocument) {
    this.diagnostics.set(document.uri, new Map())
    this.histories.set(document.uri, [])

    const diagnostics = this.diagnostics.get(document.uri)!
    const history = this.histories.get(document.uri)!

    document.host!.onDispose(
      watch(document.host!.alerts, (alerts) => {
        let shouldSend = false
        alerts.forEach((alert) => {
          const diagnostic = diagnostics.get(alert.id)

          if (diagnostic?.length) {
            if (diagnostic.some((d) => d.id === alert.id)) return
          }

          this.LOGGER.trace(`${diagnostic ? 'Update' : 'Add'}: ${alert.id} for ${document.uri}`)
          shouldSend = true
          diagnostics.set(
            alert.id,
            this.toDiagnostics(alert, document).map((diagnostic) =>
              this.rebaseWithHistory(document, diagnostic, alert.rev),
            ),
          )
        })

        if (shouldSend) this.sendDiagnostics(document, true)
      }),
    )

    document.host!.onDispose(watchEffect(() => this.sendDocumentState(document)))

    // Clear stale revision history.
    document.host!.on(ResponseKind.SUBMIT_OT, (message) => {
      const history = this.histories.get(document.uri)
      if (history && history.length > 150) {
        this.LOGGER.trace(`CleanHistory: v${document.version} rev${message.rev} ${document.uri}`)
        this.histories.set(document.uri, history.slice(history.length - 100))
      }
    })

    document.host!.on(ResponseKind.FINISHED, () => {
      this.sendDiagnostics(document)
    })

    // Repositions diagnostics as text changes.
    document.host!.onTextChange((message) => {
      this.LOGGER.trace(`Rebase: v${document.version} -> rev${message.rev} ${document.uri}`)

      history.push(message)
      diagnostics.forEach((diagnostics) => {
        diagnostics.forEach((diagnostic) => {
          this.rebaseWithChanges(document, diagnostic, message.changes)
        })
      })

      this.sendDiagnostics(document)
    })

    this.sendDiagnostics(document)
  }

  private sendDocumentState(document: GrammarlyDocument): void {
    this.connection.sendRequest(
      GrammarlyLanguageServer.Client.Feature.updateDocumentState,
      this.getDocumentState(document),
    )
  }

  private getDocumentState(document: GrammarlyDocument): GrammarlyLanguageServer.DocumentState {
    let additionalFixableErrors = 0
    let premiumErrors = 0

    document.host!.alerts.value.forEach((error) => {
      if (!error.free) ++premiumErrors
      else if (error.hidden) ++additionalFixableErrors
    })

    return {
      uri: document.uri,
      score: document.host!.score.value,
      status: document.host!.status.value,
      scores: document.host!.scores.value,
      emotions: document.host!.emotions.value,
      textInfo: document.host!.textInfo.value,
      totalAlertsCount: document.host!.alerts.value.size,
      additionalFixableAlertsCount: additionalFixableErrors,
      premiumAlertsCount: premiumErrors,
      user: document.host!.user.value,
    }
  }

  private rebaseWithChanges(document: GrammarlyDocument, diagnostic: DiagnosticWithPosition, changes: TextChange[]) {
    const range = rebaseTextRange(diagnostic, changes)

    diagnostic.start = range.start
    diagnostic.end = range.end
    diagnostic.range = document.rangeAt(range.start, range.end)

    return diagnostic
  }

  private rebaseWithHistory(document: GrammarlyDocument, diagnostic: DiagnosticWithPosition, rev: IdRevision) {
    const changes = this.findChangesSinceRevision(document, rev)

    return this.rebaseWithChanges(document, diagnostic, changes)
  }

  private findChangesSinceRevision(document: GrammarlyDocument, rev: IdRevision) {
    return this.findHistorySinceRevision(document, rev)
      .map((history) => history.changes)
      .flat()
  }

  private findHistorySinceRevision(document: GrammarlyDocument, rev: IdRevision, inclusive = false) {
    const history = this.histories.get(document.uri)
    if (history) {
      const index = history.findIndex((event) => event.rev === rev)

      if (index >= 0) {
        if (inclusive) return history.slice(index)
        else return history.slice(index + 1)
      }
    }

    return []
  }

  private toDiagnostics(alert: AlertEvent, document: GrammarlyDocument): DiagnosticWithPosition[] {
    const diagnostics: DiagnosticWithPosition[] = []

    if (this.config.settings.hideUnavailablePremiumAlerts && alert.hidden) {
      return []
    }

    const severity = getAlertSeverity(alert)
    if (isNumber(alert.begin) && isNumber(alert.end)) {
      if (!alert.title) {
        this.LOGGER.warn('toDiagnostics', `Missing title`, alert)
      }

      diagnostics.push({
        id: alert.id,
        code: alert.id,
        message: toText(alert.title || alert.categoryHuman),
        range: document.rangeAt(alert.highlightBegin, alert.highlightEnd),
        source: SOURCE,
        severity: severity,
        tags: severity === DiagnosticSeverity.Hint ? [DiagnosticTag.Unnecessary] : [],

        rev: alert.rev,
        start: alert.highlightBegin,
        end: alert.highlightEnd,
      })
    } else if (alert.subalerts) {
      const relatedInformation: DiagnosticRelatedInformation[] = []
      alert.subalerts.forEach((subalert) => {
        const { s: start, e: end } = subalert.transformJson.context
        subalert.transformJson.highlights.forEach((highlight) => {
          const highlightBegin = start + highlight.s
          const highlightEnd = start + highlight.e
          const range = document.rangeAt(highlightBegin, highlightEnd)
          const message = toText(alert.title || alert.categoryHuman)

          relatedInformation.push({ location: { uri: document.uri, range }, message: subalert.highlightText })

          diagnostics.push({
            id: alert.id,
            code: alert.id,
            message,
            range,
            source: SOURCE,
            severity: severity,
            relatedInformation,

            rev: alert.rev,
            start: highlightBegin,
            end: highlightEnd,
          })
        })
      })
    } else {
      this.LOGGER.warn('toDiagnostics', `Unhandled alert`, alert)
    }

    return diagnostics
  }

  private clearDiagnostics(document: GrammarlyDocument) {
    this.connection.sendDiagnostics({ uri: document.uri, version: document.version, diagnostics: [] })
  }

  private sendDiagnostics(document: GrammarlyDocument, ignoreVersion = false) {
    const diagnostics = Array.from(this.diagnostics.get(document.uri)?.values() || []).flat()

    this.LOGGER.debug(`Diagnostics: Sending ${diagnostics.length} alerts`, diagnostics)
    if (ignoreVersion) {
      this.connection.sendDiagnostics({ uri: document.uri, diagnostics: diagnostics })
    } else {
      this.connection.sendDiagnostics({ uri: document.uri, version: document.version, diagnostics: diagnostics })
    }
  }
}

function toText(...html: string[]) {
  return html
    .filter((value) => typeof value === 'string')
    .join('\n\n')
    .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<p>/gi, '\n\n') // Explanation has unclosed <p> tag.)
    .replace(/<br\/>/gi, '  \n')
    .replace(/<[a-z][^/>]*?\/?>/gi, '')
    .replace(/<\/[a-z][^>]*?>/gi, '')
    .replace(/\n{3,}/g, '\n\n') // Remove unnecessary empty lines.
    .trim()
}

function toMarkdown(...html: string[]) {
  return html
    .filter((value) => typeof value === 'string')
    .join('\n\n')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<p>/gi, '\n\n') // Explanation has unclosed <p> tag.)
    .replace(/<br\/>/gi, '  \n')
    .replace(/<span class="red">/gi, '❌ <span style="color:#FF0000">')
    .replace(/<span class="green">/gi, '✅ <span style="color:#00FF00">')
    .replace(/\n{3,}/g, '\n\n') // Remove unnecessary empty lines.
    .trim()
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function getAlertSeverity(alert: AlertEvent): DiagnosticSeverity {
  if (alert.impact === 'critical') return DiagnosticSeverity.Error
  switch (alert.cardLayout.outcome.toLowerCase()) {
    case 'clarity':
    case 'engagement':
      return DiagnosticSeverity.Information
    case 'tone':
      return DiagnosticSeverity.Warning
    case 'vox':
      return DiagnosticSeverity.Hint
    case 'correctness':
    case 'other':
    default:
      return DiagnosticSeverity.Error
  }
}
