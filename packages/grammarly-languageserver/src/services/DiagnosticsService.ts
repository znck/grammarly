import { Suggestion, SuggestionId } from '@grammarly/sdk'
import { inject, injectable } from 'inversify'
import type { Connection, Diagnostic, DiagnosticSeverity, Disposable, Range } from 'vscode-languageserver'
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
    this.#connection.onRequest('$/pause', ([uri]: [uri: string]) => {
      const document = this.#documents.get(uri)
      if (document == null) return
      document.pause()
      this.#sendDiagnostics(document)
    })
    this.#connection.onRequest('$/resume', ([uri]: [uri: string]) => {
      const document = this.#documents.get(uri)
      if (document == null) return
      document.resume()
      this.#sendDiagnostics(document)
    })
    return { dispose() {} }
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
    this.#connection.console.log(`${document.session.status} ${document.original.uri}`)
    const diagnostics = new Map<SuggestionId, SuggestionDiagnostic>()
    const sendDiagnostics = (): void => this.#sendDiagnostics(document)

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
      this.#connection.console.log(`${event.detail} ${document.original.uri}`)
      this.#connection.sendNotification('$/onDocumentStatus', {
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

  #sendDiagnostics(document: GrammarlyDocument) {
    const diagnostics = this.#diagnostics.get(document.original.uri) ?? new Map()

    this.#connection.sendDiagnostics({
      uri: document.original.uri,
      diagnostics: document.isPaused ? [] : Array.from(diagnostics.values()).map((item) => item.diagnostic),
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
      severity: suggestion.type === 'corrective' ? 1 : 3,
    }
  }
}
