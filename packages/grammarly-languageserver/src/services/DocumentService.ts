import type { RichText, SDK, Session, SuggestionId } from '@grammarly/sdk'
import { inject, injectable } from 'inversify'
import type {
  Connection,
  Disposable,
  ServerCapabilities,
  TextDocuments,
  TextDocumentsConfiguration,
} from 'vscode-languageserver'
import type { Range, TextDocumentContentChangeEvent } from 'vscode-languageserver-textdocument'
import { TextDocument } from 'vscode-languageserver-textdocument'
import Parser from 'web-tree-sitter'
import { CLIENT_INITIALIZATION_OPTIONS, CONNECTION, GRAMMARLY_SDK, SERVER, TEXT_DOCUMENTS_FACTORY } from '../constants'
import { InitializationOptions } from '../interfaces/InitializationOptions'
import { Registerable } from '../interfaces/Registerable'
import { createParser, transformers, SourceMap, Transformer } from 'grammarly-richtext-encoder'
import { ConfigurationService } from './ConfigurationService'

@injectable()
export class DocumentService implements Registerable {
  #config: ConfigurationService
  #connection: Connection
  #capabilities: ServerCapabilities
  #documents: TextDocuments<GrammarlyDocument>
  #onDocumentOpenCbs: Array<(document: GrammarlyDocument) => void | Promise<void>> = []
  #onDocumentCloseCbs: Array<(document: GrammarlyDocument) => void | Promise<void>> = []

  public constructor(
    @inject(CONNECTION) connection: Connection,
    @inject(SERVER) capabilities: ServerCapabilities,
    @inject(GRAMMARLY_SDK) sdk: SDK,
    @inject(TEXT_DOCUMENTS_FACTORY) createTextDocuments: <T>(config: TextDocumentsConfiguration<T>) => TextDocuments<T>,
    @inject(CLIENT_INITIALIZATION_OPTIONS) options: InitializationOptions,
    config: ConfigurationService,
  ) {
    this.#connection = connection
    this.#capabilities = capabilities
    this.#config = config
    this.#documents = createTextDocuments({
      create(uri, languageId, version, content) {
        const document = new GrammarlyDocument(TextDocument.create(uri, languageId, version, content), async () => {
          const options = await config.getDocumentSettings(uri)
          connection.console.log(`create text checking session for "${uri}" with ${JSON.stringify(options, null, 2)} `)
          return sdk.withText({ ops: [] }, options)
        })
        if (options.startTextCheckInPausedState === true) document.pause()
        return document
      },
      update(document, changes, version) {
        document.update(changes, version)
        return document
      },
    })
  }

  public register(): Disposable {
    this.#capabilities.textDocumentSync = {
      openClose: true,
      change: 2,
    }

    this.#documents.listen(this.#connection)

    this.#connection.onRequest('$/getDocumentStatus', async ([uri]: [uri: string]) => {
      const document = this.#documents.get(uri)
      if (document == null) return null
      if (document.isPaused) return 'paused'
      await document.isReady()
      return document.session.status
    })

    this.#connection.onRequest(
      '$/dismissSuggestion',
      async ([options]: [{ uri: string; suggestionId: SuggestionId }]) => {
        const document = this.#documents.get(options.uri)
        if (document == null) return
        await document.session.dismissSuggestion({ suggestionId: options.suggestionId })
      },
    )

    this.#connection.onDidChangeConfiguration(async () => {
      await Promise.all(
        this.#documents.all().map(async (document) => {
          await document.isReady()
          document.session.setConfig(await this.#config.getDocumentSettings(document.original.uri))
        }),
      )
    })

    const disposables = [
      this.#documents.onDidOpen(async ({ document }) => {
        this.#connection.console.log('open ' + document.original.uri)
        await document.isReady()
        this.#connection.console.log('ready ' + document.original.uri)
        this.#connection.sendNotification('$/grammarlyCheckingStatus', {
          uri: document.original.uri,
          status: document.session.status,
        })
        this.#onDocumentOpenCbs.forEach((cb) => cb(document))
      }),
      this.#documents.onDidClose(({ document }) => {
        console.log('close', document.original.uri)
        this.#onDocumentCloseCbs.forEach((cb) => cb(document))
        document.session.disconnect()
      }),
      {
        dispose: () => {
          this.#documents.all().forEach((document) => document.session.disconnect())
          this.#onDocumentOpenCbs.length = 0
          this.#onDocumentCloseCbs.length = 0
        },
      },
    ]

    return {
      dispose() {
        disposables.forEach((disposable) => disposable.dispose())
      },
    }
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
  public original: TextDocument
  public session!: Session<RichText>
  private readonly createSession: () => Promise<Session<RichText>>

  #context: {
    parser: Parser
    tree: Parser.Tree
    transformer: Transformer
    sourcemap: SourceMap
  } | null = null

  constructor(original: TextDocument, createSession: () => Promise<Session<RichText>>) {
    this.original = original
    this.createSession = createSession
  }

  private _isReady: Promise<void> | null = null
  private _isPaused = false

  get isPaused(): boolean {
    return this._isPaused
  }

  public pause(): void {
    this._isPaused = true
  }

  public resume(): void {
    this._isPaused = false
    this.#sync()
  }

  public async isReady(): Promise<void> {
    if (this._isReady != null) await this._isReady
    if (this.session != null) return
    this._isReady = (async () => {
      this.session = await this.createSession()
      await this.#createTree()
      this.#sync()
      this._isReady = null
    })()

    await this._isReady
  }

  public findOriginalOffset(offset: number): number {
    if (this.#context == null) return offset
    const map = this.#context.sourcemap
    const index = binarySearchLowerBound(0, map.length - 1, (index) => map[index][1] < offset)
    const node = map[index]
    if (node == null) return 0
    return node[0] + Math.max(0, offset - node[1])
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

    this.#sync()
  }

  async #createTree() {
    const language = this.original.languageId

    switch (language) {
      case 'html':
      case 'markdown':
        const parser = await createParser(language)
        const transformer = transformers[language]
        const tree = parser.parse(this.original.getText())
        this.#context = { parser, tree, transformer, sourcemap: [] }
        break
    }
  }

  #sync(): void {
    if (this._isPaused) return
    if (this.#context != null) {
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
    const mid = Math.ceil((hi + lo) / 2)
    if (isValid(mid)) {
      lo = mid
    } else {
      hi = mid - 1
    }
  }

  return hi
}
