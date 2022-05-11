import { inject, injectable } from 'inversify'
import type { Connection, Disposable, ServerCapabilities } from 'vscode-languageserver'
import { CONNECTION, SERVER } from '../constants'
import { Registerable } from '../interfaces/Registerable'
import { DiagnosticsService } from './DiagnosticsService'
import { DocumentService } from './DocumentService'
import { toMarkdown } from './toMarkdown'

@injectable()
export class HoverService implements Registerable {
  #connection: Connection
  #capabilities: ServerCapabilities
  #documents: DocumentService
  #diagnostics: DiagnosticsService

  public constructor(
    @inject(CONNECTION) connection: Connection,
    @inject(SERVER) capabilities: ServerCapabilities,
    diagnostics: DiagnosticsService,
    documents: DocumentService,
  ) {
    this.#connection = connection
    this.#capabilities = capabilities
    this.#diagnostics = diagnostics
    this.#documents = documents
  }

  register(): Disposable {
    this.#capabilities.hoverProvider = true

    this.#connection.onHover(async ({ textDocument, position }) => {
      const document = this.#documents.get(textDocument.uri)
      if (document == null) return null
      const diagnostics = this.#diagnostics.findSuggestionDiagnostics(document, { start: position, end: position })
      diagnostics.sort((a, b) => b.suggestion.highlights[0].start - a.suggestion.highlights[0].start)
      const diagnostic = diagnostics[0]
      if (diagnostic == null) return null

      const contents = `**${diagnostic.suggestion.title.trim()}**\n\n${toMarkdown(
        diagnostic.suggestion.description,
      ).trim()}\n\n\n${
        diagnostic.suggestion.replacements.length === 1
          ? `… ${toMarkdown(diagnostic.suggestion.replacements[0].preview).trim()} …`
          : diagnostic.suggestion.replacements
              .map((replacement) => `1. … ${toMarkdown(replacement.preview).trim()} …\n`)
              .join('')
      }`

      return {
        range: diagnostic.diagnostic.range,
        contents: {
          kind: 'markdown',
          value: contents,
        },
      }
    })

    return { dispose() {} }
  }
}
