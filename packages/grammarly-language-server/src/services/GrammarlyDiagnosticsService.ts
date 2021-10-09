import { inject, injectable } from 'inversify'
import {
  AlertEvent,
  IdAlert,
  IdRevision,
  ResponseKind,
  applyDelta
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
  ServerCapabilities
} from 'vscode-languageserver'
import { Position, Range, TextDocument } from 'vscode-languageserver-textdocument'
import { CONNECTION, SERVER } from '../constants'
import { DevLogger } from '../DevLogger'
import { GrammarlyDocument } from '../GrammarlyDocument'
import { Registerable } from '../interfaces'
import { isNumber } from '../is'
import { GrammarlyLanguageServer } from '../protocol'
import { watch, watchEffect } from '../watch'
import { ConfigurationService } from './ConfigurationService'
import { DocumentService } from './DocumentService'

interface DiagnosticWithPosition extends Diagnostic {
  id: IdAlert
  rev: IdRevision
  start: number
  end: number
}

const SOURCE = 'Grammarly'

@injectable()
export class GrammarlyDiagnosticsService implements Registerable {
  private LOGGER = new DevLogger(GrammarlyDiagnosticsService.name)
  private diagnostics = new Map<string, Map<IdAlert, DiagnosticWithPosition[]>>()

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

    this.connection.onRequest(GrammarlyLanguageServer.Feature.dismissAlert, (options) => {
      this.LOGGER.trace(`${GrammarlyLanguageServer.Feature.dismissAlert}(${JSON.stringify(options, null, 2)})`)
      const document = this.documents.get(options.uri)
      this.diagnostics.get(options.uri)?.delete(options.id)
      if (document?.host) {
        document.host.dismissAlert(options.id)
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
      this.LOGGER.trace('Hover', 'Active diagnostics at', diagnostics)
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
          ? '> 👉 [Login](https://www.grammarly.com/signin) to get automated fix for this issue.'
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

      this.LOGGER.trace('Hover', 'Sending', hover)

      return hover
    })

    this.connection.onCodeAction(async ({ textDocument, context }) => {
      const document = this.documents.get(textDocument.uri)
      const diagnostics = context.diagnostics.filter((diagnostic) => diagnostic.source === SOURCE)
      this.LOGGER.trace(`CodeAction in ${textDocument.uri}`, diagnostics)
      const actions: CodeAction[] = []
      const showDeletedText = this.config.settings.showDeletedTextInQuickFix
      if (diagnostics.length >= 1 && document?.host) {
        const diagnostic = diagnostics[0]
        const alert = document.host.getAlert(diagnostic.code as IdAlert)

        if (alert) {
          if (isNumber(alert.begin) && alert.replacements.length > 0) {
            const replacementRange = document.rangeAt(alert.begin, alert.end)
            alert.replacements.forEach((newText, index) => {
              actions.push({
                title: `${alert.minicardTitle}${showDeletedText ? `: "${document.getText(replacementRange)}"` : ''} -> "${newText}"`,
                kind: CodeActionKind.QuickFix,
                diagnostics: diagnostics,
                isPreferred: index === 0,
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
                        range: replacementRange,
                        newText: newText,
                      },
                    ],
                  },
                },
              })
            })
          } else if (alert.subalerts != null) {
            const len = Math.min(...alert.subalerts.map(subalert => subalert.transformJson.alternatives.length))
            const subAlerts = alert.subalerts.slice()
            subAlerts.sort((a, b) => b.transformJson.context.s - a.transformJson.context.s)
            for (let i = 0; i < len; ++i) {

              const { label, highlightText } = alert.subalerts[i]
              actions.push({
                title: `REPLACE ALL: ${alert.minicardTitle}${label === highlightText ? '' : ` (${label})`} -> "${highlightText}"`,
                kind: CodeActionKind.QuickFix,
                diagnostics: diagnostics,
                command: {
                  command: 'grammarly.callback',
                  title: '',
                  arguments: [
                    {
                      method: GrammarlyLanguageServer.Feature.acceptAlert,
                      params: { id: alert.id, uri: textDocument.uri },
                    },
                  ],
                },

                edit: {
                  changes: {
                    [textDocument.uri]: subAlerts.map(subAlert => {
                      const range = document.rangeAt(subAlert.transformJson.context.s, subAlert.transformJson.context.e)
                      const oldText = document.getText(range)
                      const newText = applyDelta(oldText, subAlert.transformJson.alternatives[i])

                      console.log({ oldText, newText })

                      return { range, newText }
                    }),
                  },
                },
              })
            }
          }

          actions.push({
            title: `Ignore Grammarly issue`,
            kind: CodeActionKind.QuickFix,
            diagnostics: diagnostics,
            command: {
              command: 'grammarly.callback',
              title: 'Grammarly: Dismiss Alert',
              arguments: [
                {
                  method: GrammarlyLanguageServer.Feature.dismissAlert,
                  params: { id: alert.id, uri: textDocument.uri },
                },
              ],
            },
          })
        }
      }

      if (__DEV__) this.LOGGER.trace('Providing code actions', actions)

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

  private async setupDiagnostics(document: GrammarlyDocument) {
    this.diagnostics.set(document.uri, new Map())

    const diagnostics = this.diagnostics.get(document.uri)!
    const ignoredTags = await this.config.getIgnoredTags(document.uri, document.languageId);

    document.host!.onDispose(
      watch(document.host!.alerts, (alerts) => {
        diagnostics.clear()

        alerts.forEach((alert) => {
          if (document.inIgnoredRange([alert.begin, alert.end], ignoredTags)) {
            document.host!.dismissAlert(alert.id);
          } else {
            diagnostics.set(
              alert.id,
              this.toDiagnostics(alert, document)
            )
          }
        })

        this.sendDiagnostics(document, true)
      }),
    )

    document.host!.onDispose(watchEffect(() => this.sendDocumentState(document)))

    document.host!.on(ResponseKind.FINISHED, () => {
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
      alert.subalerts.forEach((subalert, i) => {
        const { s: start } = subalert.transformJson.context
        let highlightBegin: number = 0
        let highlightEnd: number = 0
        let range: Range = {} as any
        subalert.transformJson.highlights.forEach((highlight, j) => {
          const s = start + highlight.s
          const e = start + highlight.e
          const r = document.rangeAt(s, e)
          if (j <= i) {
            highlightBegin = s
            highlightEnd = e
            range = r
          }

          relatedInformation.push({ location: { uri: document.uri, range: r }, message: subalert.highlightText })
        })

        diagnostics.push({
          id: alert.id,
          code: alert.id,
          message: toText(alert.title || alert.categoryHuman),
          range: range,
          source: SOURCE,
          severity: severity,
          relatedInformation,

          rev: alert.rev,
          start: highlightBegin,
          end: highlightEnd,
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

    this.LOGGER.trace(`Diagnostics: Sending ${diagnostics.length} alerts`, diagnostics)
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
