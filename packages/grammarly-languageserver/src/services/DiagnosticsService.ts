import { Markup, MarkupChild, Suggestion, SuggestionId } from '@grammarly/sdk'
import { inject, injectable } from 'inversify'
import { Connection, Diagnostic, DiagnosticSeverity, Disposable, Range } from 'vscode-languageserver/node'
import { CONNECTION } from '../constants'
import { Registerable } from '../interfaces/Registerable'
import { DocumentService, GrammarlyDocument } from './DocumentService'

export type SuggestionDiagnostic = {
  diagnostic: Diagnostic
  suggestion: Suggestion
}

@injectable()
export class DiagnosticsService implements Registerable {
  #connection: Connection
  #documents: DocumentService
  #diagnostics: Map<string, Map<SuggestionId, SuggestionDiagnostic>>

  public constructor(@inject(CONNECTION) connection: Connection, documents: DocumentService) {
    this.#connection = connection
    this.#documents = documents
    this.#diagnostics = new Map()
  }

  public register(): Disposable {
    this.#documents.onDidOpen((document) => this.#setupDiagnostics(document))
    this.#documents.onDidClose((document) => this.#clearDiagnostics(document))
    return Disposable.create(() => {})
  }

  public findSuggestionDiagnostics(document: GrammarlyDocument, range: Range): SuggestionDiagnostic[] {
    const diagnostics: SuggestionDiagnostic[] = []
    const s = document.original.offsetAt(range.start)
    const e = document.original.offsetAt(range.end)
    this.#diagnostics.get(document.original.uri)?.forEach((item) => {
      const start = document.original.offsetAt(item.diagnostic.range.start)
      const end = document.original.offsetAt(item.diagnostic.range.end)
      if (start <= e && s <= end) diagnostics.push(item)
    })

    return diagnostics
  }

  public getSuggestionDiagnostic(document: GrammarlyDocument, code: string): SuggestionDiagnostic | undefined {
    return this.#diagnostics.get(document.original.uri)?.get(code)
  }

  #setupDiagnostics(document: GrammarlyDocument) {
    console.log(document.session.status, document.original.uri)
    const diagnostics = new Map<SuggestionId, SuggestionDiagnostic>()
    const sendDiagnostics = (): void => {
      this.#connection.sendDiagnostics({
        uri: document.original.uri,
        diagnostics: Array.from(diagnostics.values()).map((item) => item.diagnostic),
      })
    }

    this.#diagnostics.set(document.original.uri, diagnostics)
    document.session.addEventListener('suggestions', (event) => {
      event.detail.added.forEach((suggestion) => {
        diagnostics.set(suggestion.id, { suggestion, diagnostic: this.#toDiagnostic(document, suggestion) })
      })
      event.detail.updated.forEach((suggestion) => {
        diagnostics.set(suggestion.id, { suggestion, diagnostic: this.#toDiagnostic(document, suggestion) })
      })
      event.detail.removed.forEach((suggestion) => {
        diagnostics.delete(suggestion.id)
      })
      sendDiagnostics()
    })
    document.session.addEventListener('status', (event) => {
      console.log(event.detail, document.original.uri)
      this.#connection.sendNotification('$/grammarlyCheckingStatus', {
        uri: document.original.uri,
        status: event.detail,
      })

      switch (event.detail) {
        case 'idle':
          diagnostics.clear()
          document.session.suggestions.forEach((suggestion) => {
            diagnostics.set(suggestion.id, { suggestion, diagnostic: this.#toDiagnostic(document, suggestion) })
          })
          sendDiagnostics()
          break
      }
    })
  }

  #clearDiagnostics(document: GrammarlyDocument): void {
    this.#connection.sendDiagnostics({
      uri: document.original.uri,
      version: document.original.version,
      diagnostics: [],
    })
  }

  #toDiagnostic(document: GrammarlyDocument, suggestion: Suggestion): Diagnostic {
    const highlight = suggestion.highlights[0]

    return {
      data: suggestion.id,
      message: suggestion.title,
      range: document.findOriginalRange(highlight.start, highlight.end),
      source: 'Grammarly',
      severity: suggestion.type === 'corrective' ? DiagnosticSeverity.Error : DiagnosticSeverity.Information,
    }
  }
}

function toText(markup: Markup): string {
  function stringify(node: MarkupChild): string {
    if (typeof node === 'string') return node

    switch (node.type) {
      case 'ul':
        return `\n${node.children.map((node) => `- ${stringify(node)}`).join('\n')}\n`
      default:
        return node.children.map(stringify).join('')
    }
  }

  return markup.map(stringify).join('')
}

export function toMarkdown(markup: Markup): string {
  let indent = 0
  function stringify(node: MarkupChild): string {
    if (typeof node === 'string') return node

    switch (node.type) {
      case 'ul':
        try {
          indent += 2
          return `\n${node.children.map(stringify).join('\n')}`
        } finally {
          indent -= 2
        }
      case 'li':
        return ' '.repeat(indent - 2) + `- ${node.children.map(stringify).join('')}`
      case 'del':
        return ` ~~${node.children.map(stringify).join('')}~~ `
      case 'em':
        return `_${node.children.map(stringify).join('')}_`
      case 'strong':
        return `**${node.children.map(stringify).join('')}**`
      default:
        return node.children.map(stringify).join('')
    }
  }

  return markup.map(stringify).join('')
}
