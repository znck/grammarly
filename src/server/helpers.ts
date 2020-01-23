import { Grammarly } from '@/shared/grammarly'
import { CodeAction, Diagnostic, DiagnosticSeverity, Range, TextDocument } from 'vscode-languageserver'
import { env } from './env'

export function createGrammarlyFix(alert: Grammarly.Alert, replacement: string, document: TextDocument): CodeAction {
  return {
    title: `${alert.todo} -> ${replacement}`.replace(/^[a-z]/, m => m.toLocaleUpperCase()),
    kind: 'quickfix' /* CodeActionKind.QuickFix */,
    diagnostics: [createDiagnostic(alert, document)],
    isPreferred: true,
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
  }
}

export function createGrammarlySynonymFix(
  word: string,
  replacement: { base: string; derived: string },
  document: TextDocument,
  range: Range
): CodeAction {
  return {
    title: `${word} -> ${replacement.derived}`,
    kind: 'quickfix' /* CodeActionKind.QuickFix */,
    edit: {
      changes: {
        [document.uri]: [
          {
            range,
            newText: replacement.derived,
          },
        ],
      },
    },
  }
}

export function createAddToDictionaryFix(document: TextDocument, alert: Grammarly.Alert, target: string): CodeAction {
  return {
    title: `Grammarly: add "${alert.text}" to ${target} dictionary`,
    kind: 'quickfix',
    command: {
      command: 'grammarly.addWord',
      title: `Grammarly: save to ${target} dictionary`,
      arguments: [target, document.uri, alert.id, alert.text],
    },
  }
}

export function createIgnoreFix(document: TextDocument, alert: Grammarly.Alert): CodeAction {
  return {
    title: `Grammarly: ignore issue`,
    kind: 'quickfix',
    command: {
      command: 'grammarly.ignoreIssue',
      title: `Grammarly: ignore`,
      arguments: [document.uri, alert.id],
    },
  }
}

export function isSpellingAlert(alert: Grammarly.Alert) {
  return alert.group === 'Spelling'
}

export function capturePromiseErrors<T extends Function>(fn: T, fallback?: unknown): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args)
    } catch (error) {
      console.error(error)
      return fallback
    }
  }) as any
}

export function createDiagnostic(alert: Grammarly.Alert, document: TextDocument) {
  const diagnostic: Diagnostic = {
    severity: getAlertSeverity(alert),
    message: (alert.title || alert.categoryHuman!).replace(/<\/?[^>]+(>|$)/g, ''),
    source: 'Grammarly',
    code: alert.id,
    range: getRangeInDocument(document, alert.begin, alert.end),
    tags: alert.hidden ? [1] : [],
  }

  if (env.hasDiagnosticRelatedInformationCapability) {
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

export function shouldIncludeAdditionalInformation(alert: Grammarly.Alert): boolean {
  return !!(alert.highlightText && alert.highlightText.length <= 60)
}

export function getAlertSeverity(alert: Grammarly.Alert): DiagnosticSeverity {
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

export function getRangeInDocument(document: TextDocument, start: number, end: number): Range {
  return {
    start: document.positionAt(start),
    end: document.positionAt(end),
  }
}
