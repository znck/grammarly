import { inject, injectable } from 'inversify'
import { Connection, Disposable, ServerCapabilities, TextDocuments, TextDocumentSyncKind } from 'vscode-languageserver'
import { CONNECTION, SERVER } from '../constants'
import { GrammarlyDocument } from '../GrammarlyDocument'
import { GrammarlyHostFactory } from '../GrammarlyHostFactory'
import { Registerable } from '../interfaces'
import { ConfigurationService } from './ConfigurationService'

@injectable()
export class DocumentService implements Registerable {
  private documents = new TextDocuments(GrammarlyDocument)
  private hostFactory = new GrammarlyHostFactory(
    async (document) => this.configuration.getDocumentSettings(document.uri),
    async () => this.getCredentials(),
    async (token) => this.connection.sendRequest('$/storeToken', { token }),
  )

  private onDocumentOpenCbs: Array<(document: GrammarlyDocument) => any> = []
  private onDocumentCloseCbs: Array<(document: GrammarlyDocument) => any> = []

  constructor(
    @inject(CONNECTION) private readonly connection: Connection,
    @inject(SERVER) private readonly capabilities: ServerCapabilities,
    private readonly configuration: ConfigurationService,
  ) {}

  register() {
    this.capabilities.textDocumentSync = {
      openClose: true,
      change: TextDocumentSyncKind.Incremental,
    }

    this.documents.listen(this.connection)

    const disposables = [
      this.documents.onDidOpen(({ document }) => this.attachHost(document)),
      this.documents.onDidClose(({ document }) => this.handleClose(document)),
      Disposable.create(() => this.documents.all().forEach((document) => document.detachHost())),
    ]

    return Disposable.create(() => disposables.forEach((disposable) => disposable.dispose()))
  }

  get(uri: string) {
    return this.documents.get(uri)
  }

  onDidOpen(fn: (document: GrammarlyDocument) => any) {
    this.onDocumentOpenCbs.push(fn)
  }

  onDidClose(fn: (document: GrammarlyDocument) => any) {
    this.onDocumentCloseCbs.push(fn)
  }

  async attachHost(document: GrammarlyDocument, force = false) {
    if (!this.configuration.settings.autoActivate && !force) return

    document.attachHost(this.hostFactory)
    this.onDocumentOpenCbs.forEach((cb) => cb(document))
  }

  private async getCredentials() {
    try {
      const result = await this.connection.sendRequest<{ token: string }>('$/token')
      if (result) return result.token
    } catch {}

    return this.connection.sendRequest<{ username: string; password: string }>('$/credentials')
  }

  private async handleClose(document: GrammarlyDocument) {
    this.onDocumentCloseCbs.forEach((cb) => cb(document))
    document.detachHost()
  }
}
