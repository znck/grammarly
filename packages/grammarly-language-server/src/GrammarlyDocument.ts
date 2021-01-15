import { Position, Range, TextDocument, TextDocumentContentChangeEvent } from 'vscode-languageserver-textdocument'
import { GrammarlyHostFactory } from './GrammarlyHostFactory'
import { TextGrammarCheckHost } from './hosts/TextGrammarCheckHost'
import { parsers } from './parsers'

export class GrammarlyDocument implements TextDocument {
  private _host: TextGrammarCheckHost | null = null
  private isDirty = true
  private rangeToIdentifierFn?: (interval: [number, number]) => string[]

  private constructor(private internal: TextDocument) {}

  attachHost(factory: GrammarlyHostFactory, clientInfo: { name: string; version?: string }) {
    this.detachHost()

    this._host = factory.create(this, clientInfo)
  }

  detachHost() {
    if (this._host) {
      this._host.dispose()
      this._host = null
    }
  }

  inIgnoredRange(interval: [number, number], tags: string[]): boolean {
    if (this.isDirty) {
      this.isDirty = false
      const parser = parsers[this.languageId]

      try {
        if (parser) this.rangeToIdentifierFn = parser.parse(this.getText())
      } catch {}
    }

    if (this.rangeToIdentifierFn) {
      const matched = new Set(this.rangeToIdentifierFn(interval))

      return tags.some((tag) => matched.has(tag))
    }

    return false
  }

  get host() {
    return this._host
  }

  get uri() {
    return this.internal.uri
  }

  get languageId() {
    return this.internal.languageId
  }

  get version() {
    return this.internal.version
  }

  getText(range?: Range): string {
    return this.internal.getText(range)
  }

  positionAt(offset: number): Position {
    return this.internal.positionAt(offset)
  }

  rangeAt(start: number, end: number): Range {
    return { start: this.positionAt(start), end: this.positionAt(end) }
  }

  offsetAt(position: Position): number {
    return this.internal.offsetAt(position)
  }

  get lineCount() {
    return this.internal.lineCount
  }

  static create(uri: string, languageId: string, version: number, content: string): GrammarlyDocument {
    return new GrammarlyDocument(TextDocument.create(uri, languageId, version, content))
  }

  static update(
    document: GrammarlyDocument,
    changes: TextDocumentContentChangeEvent[],
    version: number,
  ): GrammarlyDocument {
    document.isDirty = true

    if (document._host) {
      const editor = document._host.edit(document.internal.getText().length, version)
      changes.forEach((change) => {
        if ('range' in change) {
          const start = document.offsetAt(change.range.start)
          const end = document.offsetAt(change.range.end)
          const deleteLength = end - start

          if (deleteLength) {
            editor.deleteText(start, deleteLength)
            if (change.text.length) editor.setText(change.text)
          } else if (change.text.length) {
            editor.insertText(start, change.text)
          }
        } else {
          editor.setText(change.text)
        }

        editor.commit()
      })

      editor.commit().apply()
    }

    document.internal = TextDocument.update(document.internal, changes, version)

    return document
  }
}
