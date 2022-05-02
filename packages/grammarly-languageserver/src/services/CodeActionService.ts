import { inject, injectable } from 'inversify'
import { CodeAction, CodeActionKind, Connection, Disposable, ServerCapabilities } from 'vscode-languageserver/node'
import { CONNECTION, SERVER } from '../constants'
import { Registerable } from '../interfaces/Registerable'
import { DiagnosticsService, SuggestionDiagnostic } from './DiagnosticsService'
import { DocumentService } from './DocumentService'

@injectable()
export class CodeActionService implements Registerable {
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
    this.#capabilities.codeActionProvider = {
      codeActionKinds: [CodeActionKind.QuickFix],
    }

    this.#connection.onCodeAction(async ({ textDocument, context }): Promise<CodeAction[]> => {
      const document = this.#documents.get(textDocument.uri)
      if (document == null) return []
      return await Promise.all(
        context.diagnostics
          .map((diagnostic) =>
            typeof diagnostic.data === 'string'
              ? this.#diagnostics.getSuggestionDiagnostic(document, diagnostic.data)
              : null,
          )
          .filter((item): item is SuggestionDiagnostic => item != null)
          .flatMap(({ suggestion, diagnostic }) => {
            const uri = document.original.uri
            return suggestion.replacements.map(async (replacement, index): Promise<CodeAction> => {
              const edit = await document.session.applySuggestion({
                suggestionId: suggestion.id,
                replacementId: replacement.id,
              })
              const range = document.findOriginalRange(edit.range.start, edit.range.end)
              const newText = document.toText(edit.content)
              return {
                title: replacement.label ?? suggestion.title,
                kind: CodeActionKind.QuickFix,
                diagnostics: [diagnostic],
                isPreferred: index === 0,
                edit: {
                  changes: {
                    [uri]: [{ range, newText }],
                  },
                },
              }
            })
          }),
      )
    })

    return { dispose() {} }
  }
}
