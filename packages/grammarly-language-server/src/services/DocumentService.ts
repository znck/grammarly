import type { RichText, Session } from '@grammarly/sdk'
import type { SDK } from '@grammarly/sdk'
import { inject, injectable } from 'inversify'
import {
  Connection,
  Disposable,
  ServerCapabilities,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node'
import type { Position, Range, TextDocumentContentChangeEvent } from 'vscode-languageserver-textdocument'
import { TextDocument } from 'vscode-languageserver-textdocument'
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
        await document.isReady()
        this.#onDocumentOpenCbs.forEach((cb) => cb(document))
      }),
      this.#documents.onDidClose(({ document }) => {
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

  constructor(original: TextDocument, session: Session<RichText>) {
    this.original = original
    this.session = session
  }

  public async isReady(): Promise<void> {
    this.#sync()
  }

  public findOriginalOffset(offset: number): number {
    return offset
  }

  public findTransformedOffset(offset: number): number | undefined {
    return offset
  }

  public findOriginalRange(start: number, end: number): Range {
    return {
      start: this.original.positionAt(this.findOriginalOffset(start)),
      end: this.original.positionAt(this.findOriginalOffset(end)),
    }
  }

  public update(changes: TextDocumentContentChangeEvent[], version: number): void {
    TextDocument.update(this.original, changes, version)
    this.#sync()
  }

  #sync(): void {
    this.session.setText({ ops: [{ insert: this.original.getText() }] })
  }
}
