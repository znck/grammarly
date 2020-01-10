import { CodeAction, TextDocument, Range } from 'vscode-languageserver'
import { Grammarly } from '../grammarly'
import { createDiagnostic, getRangeInDocument } from './index'

export function createGrammarlyFix(alert: Grammarly.Alert, replacement: string, document: TextDocument): CodeAction {
  return {
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
    title: `Add to ${target} dictionary`,
    kind: 'quickfix',
    command: {
      command: 'grammarly.addWord',
      title: 'Save',
      arguments: [target, document.uri, alert.id, alert.text],
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
