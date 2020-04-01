import { Grammarly } from '@/server/grammarly';
import {
  CodeAction,
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTag,
  Range,
  TextDocument,
} from 'vscode-languageserver';

export function createGrammarlyFix(
  document: TextDocument,
  alert: Grammarly.Alert,
  replacement: string,
  diagnostics: Diagnostic[] = []
): CodeAction {
  return {
    title: `${alert.todo} -> ${replacement}`.replace(/^[a-z]/, m =>
      m.toLocaleUpperCase()
    ),
    kind: 'quickfix' /* CodeActionKind.QuickFix */,
    diagnostics,
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
  };
}

export function createGrammarlySynonymFix(
  document: TextDocument,
  word: string,
  replacement: { base: string; derived: string },
  range: Range
): CodeAction {
  return {
    title: `Synonym: ${word} -> ${replacement.derived}`,
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
  };
}

export function createAddToDictionaryFix(
  document: TextDocument,
  alert: Grammarly.Alert,
  target: string
): CodeAction {
  return {
    title: `Grammarly: add "${alert.text}" to ${target} dictionary`,
    kind: 'quickfix',
    command: {
      command: 'grammarly.addWord',
      title: `Grammarly: save to ${target} dictionary`,
      arguments: [target, document.uri, alert.id, alert.text],
    },
  };
}

export function createIgnoreFix(
  document: TextDocument,
  alert: Grammarly.Alert
): CodeAction {
  return {
    title: `Grammarly: ignore issue`,
    kind: 'quickfix',
    command: {
      command: 'grammarly.ignoreIssue',
      title: `Grammarly: ignore`,
      arguments: [document.uri, alert.id],
    },
  };
}
export function toMarkdown(source: string) {
  return source
    .replace(/<p>/gi, _ => `\n\n`)
    .replace(/<br\/?>/gi, _ => `  \n`)
    .replace(/<span class="red">Incorrect:/gi, _ => `- **Incorrect:** `)
    .replace(/<span class="green">Correct:/gi, _ => `- **Correct:** `)
    .replace(/\s?<b>(.*?)<\/b>\s?/gi, (_, content) => ` **${content}** `)
    .replace(/\s?<i>(.*?)<\/i>\s?/gi, (_, content) => ` _${content}_ `)
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/\n\n(\n|\s)+/, '\n\n')
    .trim();
}

export function getMarkdownDescription(alert: Grammarly.Alert) {
  return alert.explanation || alert.details || alert.examples
    ? toMarkdown(
        `### ${alert.title}${
          alert.explanation ? `\n\n${alert.explanation}` : ''
        }${alert.details ? `\n\n${alert.details}` : ''}${
          alert.examples ? `\n\n### Examples\n\n${alert.examples}` : ''
        }`
      )
    : '';
}
export function isSpellingAlert(alert: Grammarly.Alert) {
  return alert.group === 'Spelling';
}

export function capturePromiseErrors<T extends Function>(
  fn: T,
  fallback?: unknown
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error(error);
      return fallback;
    }
  }) as any;
}

export function createDiagnostic(
  document: TextDocument,
  alert: Grammarly.Alert,
  severityMap: Record<string, DiagnosticSeverity>
) {
  const severity = severityMap[alert.category] || DiagnosticSeverity.Hint;
  const diagnostic: Diagnostic = {
    severity,
    message: (alert.title || '').replace(/<\/?[^>]+(>|$)/g, ''),
    source: 'Grammarly: ' + alert.category,
    code: alert.id,
    range: getRangeInDocument(document, alert.begin, alert.end),
    tags:
      severity === DiagnosticSeverity.Hint ? [DiagnosticTag.Unnecessary] : [],
  };

  return diagnostic;
}

export function getRangeInDocument(
  document: TextDocument,
  start: number,
  end: number
): Range {
  return {
    start: document.positionAt(start),
    end: document.positionAt(end),
  };
}
