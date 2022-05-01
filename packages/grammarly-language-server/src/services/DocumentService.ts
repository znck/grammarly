import type { RichText, SDK, Session } from '@grammarly/sdk'
import type { Parser, SourceMap, Transformer } from 'grammarly-language-server-transformers'
import { inject, injectable } from 'inversify'
import type { Range, TextDocumentContentChangeEvent } from 'vscode-languageserver-textdocument'
import { TextDocument } from 'vscode-languageserver-textdocument'
import {
  Connection,
  Disposable,
  ServerCapabilities,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node'
import { CONNECTION, GRAMMARLY_SDK, SERVER } from '../constants'
import { Registerable } from '../interfaces/Registerable'

@injectable()
export class DocumentService implements Registerable {
  #documents: TextDocuments<GrammarlyDocument>
  #onDocumentOpenCbs: Array<(document: GrammarlyDocument) => void | Promise<void>> = []
  #onDocumentCloseCbs: Array<(document: GrammarlyDocument) => void | Promise<void>> = []

  public constructor(
    @inject(CONNECTION) private readonly connection: Connection,
    @inject(SERVER) private readonly capabilities: ServerCapabilities,
    @inject(GRAMMARLY_SDK) sdk: SDK,
  ) {
    this.#documents = new TextDocuments({
      create(uri, languageId, version, content) {
        return new GrammarlyDocument(TextDocument.create(uri, languageId, version, content), sdk.withText({ ops: [] }))
      },
      update(document, changes, version) {
        document.update(changes, version)
        return document
      },
    })
  }

  public register(): Disposable {
    this.capabilities.textDocumentSync = {
      openClose: true,
      change: TextDocumentSyncKind.Incremental,
    }

    this.#documents.listen(this.connection)
    const disposables = [
      this.#documents.onDidOpen(async ({ document }) => {
        console.log('open', document.original.uri)
        await document.isReady()
        this.#onDocumentOpenCbs.forEach((cb) => cb(document))
      }),
      this.#documents.onDidClose(({ document }) => {
        console.log('close', document.original.uri)
        this.#onDocumentCloseCbs.forEach((cb) => cb(document))
        document.session.disconnect()
      }),
      Disposable.create(() => {
        this.#documents.all().forEach((document) => document.session.disconnect())
        this.#onDocumentOpenCbs.length = 0
        this.#onDocumentCloseCbs.length = 0
      }),
    ]

    return Disposable.create(() => disposables.forEach((disposable) => disposable.dispose()))
  }

  public get(uri: string): GrammarlyDocument | undefined {
    return this.#documents.get(uri)
  }

  public onDidOpen(fn: (document: GrammarlyDocument) => void | Promise<void>): void {
    this.#onDocumentOpenCbs.push(fn)
  }

  public onDidClose(fn: (document: GrammarlyDocument) => void | Promise<void>): void {
    this.#onDocumentCloseCbs.push(fn)
  }
}

export class GrammarlyDocument {
  public readonly original: TextDocument
  public readonly session: Session<RichText>

  #context: {
    parser: Parser
    tree: Parser.Tree
    transformer: Transformer
    sourcemap: SourceMap
  } | null = null

  constructor(original: TextDocument, session: Session<RichText>) {
    this.original = original
    this.session = session
  }

  public async isReady(): Promise<void> {
    await this.#createTree()

    this.#sync()
  }

  public findOriginalOffset(offset: number): number {
    if (this.#context == null) return offset
    const map = this.#context.sourcemap
    const index = binarySearchLowerBound(0, map.length - 1, (index) => map[index][1] <= offset)
    const node = map[index]
    if (node == null) return 0
    return node[0] + (offset - node[1])
  }

  public findOriginalRange(start: number, end: number): Range {
    return {
      start: this.original.positionAt(this.findOriginalOffset(start)),
      end: this.original.positionAt(this.findOriginalOffset(end)),
    }
  }

  public toText(text: RichText): string {
    return this.#context?.transformer.decode(text) ?? text.ops.map((op) => op.insert).join('')
  }

  public update(changes: TextDocumentContentChangeEvent[], version: number): void {
    const context = this.#context
    if (context == null) {
      TextDocument.update(this.original, changes, version)
      this.#sync()
    } else if (changes.every((change) => 'range' in change)) {
      const _changes = changes as Array<{ range: Range; text: string }>
      const offsets = _changes.map((change) => ({
        start: this.original.offsetAt(change.range.start),
        end: this.original.offsetAt(change.range.end),
      }))
      TextDocument.update(this.original, changes, version)
      _changes.forEach((change, index) => {
        const newEndIndex = offsets[index].start + change.text.length
        const newEndPosition = this.original.positionAt(newEndIndex)
        context.tree.edit({
          startIndex: offsets[index].start,
          oldEndIndex: offsets[index].end,
          newEndIndex: offsets[index].start + change.text.length,
          startPosition: { row: change.range.start.line, column: change.range.start.character },
          oldEndPosition: { row: change.range.end.line, column: change.range.end.character },
          newEndPosition: { row: newEndPosition.line, column: newEndPosition.character },
        })
      })
      context.tree = context.parser.parse(this.original.getText(), context.tree)
    } else {
      TextDocument.update(this.original, changes, version)
      context.tree = context.parser.parse(this.original.getText())
    }
  }

  async #createTree() {
    const language = this.original.languageId

    switch (language) {
      case 'html':
      case 'markdown':
        const { transformers, createParser } = await import('grammarly-language-server-transformers')
        const parser = await createParser(language)
        const transformer = transformers[language]
        const tree = parser.parse(this.original.getText())
        this.#context = { parser, tree, transformer, sourcemap: [] }
        break
    }
  }

  #sync(): void {
    if (this.#context != null) {
      console.log('Using encoder', this.original.uri)
      const [text, map] = this.#context.transformer.encode(this.#context.tree)
      this.session.setText(text)
      this.#context.sourcemap = map
    } else {
      this.session.setText({ ops: [{ insert: this.original.getText() }] })
    }
  }
}

function binarySearchLowerBound(lo: number, hi: number, isValid: (mid: number) => boolean): number {
  while (lo < hi) {
    const mid = Math.ceil(lo + (hi - lo) / 2)
    if (!isValid(mid)) {
      hi = mid - 1
    } else {
      lo = mid
    }
  }

  return Math.min(hi, lo)
}
