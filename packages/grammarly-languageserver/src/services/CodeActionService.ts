import { SuggestionId, SuggestionReplacementId } from '@grammarly/sdk'
import { inject, injectable } from 'inversify'
import { CodeAction, Connection, Disposable, ServerCapabilities } from 'vscode-languageserver'
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
      codeActionKinds: ['quickfix'],
      resolveProvider: true,
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
            const actions = suggestion.replacements.map((replacement): CodeAction => {
              return {
                title: suggestion.title + (replacement.label != null ? ` — ${replacement.label}` : ''),
                kind: 'quickfix',
                diagnostics: [diagnostic],
                data: {
                  uri: document.original.uri,
                  suggestionId: suggestion.id,
                  replacementId: replacement.id,
                },
              }
            })

            const dismiss: CodeAction = {
              title: `Dismiss — ${suggestion.title}`,
              kind: 'quickfix',
              diagnostics: [diagnostic],
              command: {
                title: 'Dismiss suggestion',
                command: 'grammarly.dismiss',
                arguments: [
                  {
                    uri: document.original.uri,
                    suggestionId: suggestion.id,
                  },
                ],
              },
            }

            actions.push(dismiss)

            return actions
          }),
      )
    })

    this.#connection.onCodeActionResolve(async (codeAction) => {
      if (codeAction.data == null) return codeAction
      const { uri, suggestionId, replacementId } = codeAction.data as {
        uri: string
        suggestionId: SuggestionId
        replacementId: SuggestionReplacementId
      }
      const document = this.#documents.get(uri)
      if (document == null) return codeAction

      const edit = await document.session.applySuggestion({
        suggestionId,
        replacementId,
      })
      console.log(JSON.stringify(edit, null, 2))
      const range = document.findOriginalRange(edit.range.start, edit.range.end)
      const newText = document.toText(edit.content)

      codeAction.edit = {
        changes: {
          [uri]: [{ range, newText }],
        },
      }

      return codeAction
    })

    return { dispose() {} }
  }
}
