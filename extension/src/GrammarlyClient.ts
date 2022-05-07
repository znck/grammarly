import { GrammarlyLanguageClient } from 'grammarly-languageclient'
import {
  commands,
  Disposable,
  DocumentFilter,
  env,
  ExtensionContext,
  languages,
  StatusBarAlignment,
  TextDocument,
  Uri,
  window,
  workspace,
} from 'vscode'
import { Registerable } from './interfaces'

export class GrammarlyClient implements Registerable {
  public client: GrammarlyLanguageClient
  private session?: Disposable
  private callbacks = new Set<() => unknown>()
  private isReady = false
  private selectors: DocumentFilter[] = []

  constructor(private readonly context: ExtensionContext) {
    this.client = this.createClient()
  }

  public onReady(fn: () => unknown): Disposable {
    this.callbacks.add(fn)
    if (this.isReady) fn()
    return new Disposable(() => this.callbacks.delete(fn))
  }

  public matchesDocumentSelector(document: TextDocument): boolean {
    return languages.match(this.selectors, document) > 0
  }

  private createClient(): GrammarlyLanguageClient {
    const config = workspace.getConfiguration('grammarly')

    this.selectors = [
      ...(config.get<string[]>('patterns')?.map((pattern) => ({ scheme: 'file', pattern })) ?? []),
      ...(config.get<DocumentFilter[]>('selectors')?.filter((item) => Object.keys(item).length > 0) ?? []),
    ]

    const client = new GrammarlyLanguageClient(
      isNode()
        ? this.context.asAbsolutePath(`dist/server/index.node.js`)
        : Uri.joinPath(this.context.extensionUri, `dist/server/index.browser.js`).toString(),
      {
        id: 'client_BaDkMgx4X19X9UxxYRCXZo',
        name: 'Grammarly',
        documentSelector: this.selectors
          .map((selector) =>
            selector.language != null || selector.pattern != null || selector.scheme != null ? (selector as any) : null,
          )
          .filter(<T>(value: T | null): value is T => value != null),
        errorHandler: {
          error(error) {
            window.showErrorMessage(error.message)
            return 2
          },
          closed() {
            return 1
          },
        },
      },
    )

    client.onReady().then(() => {
      client.protocol.onOpenOAuthUrl(async (url) => {
        if (!(await env.openExternal(Uri.parse(url)))) {
          // TODO: Handle?
        }
      })
    })

    return client
  }

  register() {
    return Disposable.from(
      window.registerUriHandler({
        handleUri: (uri) => {
          if (uri.path === '/auth/callback') {
            this.client.sendNotification('$/handleOAuthUrl', uri.toString())
          }
        },
      }),
      commands.registerCommand('grammarly.check', async () => {
        const document = window.activeTextEditor?.document
        if (document == null) return console.log('No active document')
        const status = await this.client.protocol.getDocumentStatus(document.uri.toString())
        if (this.matchesDocumentSelector(document) && status != null) {
          await window.showInformationMessage(`Grammarly is already enabled for this file.`, {
            detail: document.uri.toString(),
          })
        } else {
          await window.showInformationMessage(`Will add later.`, {
            detail: document.uri.toString(),
          })
        }
      }),
      { dispose: () => this.session?.dispose() },
    )
  }

  public async start(): Promise<void> {
    const statusbar = window.createStatusBarItem(StatusBarAlignment.Left, Number.MIN_SAFE_INTEGER)
    statusbar.text = '$(sync~spin) Starting Grammarly language server'
    statusbar.show()
    try {
      this.session?.dispose()
      this.client = this.createClient()
      this.session = this.client.start()
      await this.client.onReady()
      this.isReady = true
      this.callbacks.forEach((fn) => {
        try {
          fn()
        } catch (error) {
          console.error(error)
        }
      })
    } finally {
      statusbar.dispose()
    }
  }
}

function isNode(): boolean {
  return typeof process !== 'undefined' && process.versions?.node != null
}
