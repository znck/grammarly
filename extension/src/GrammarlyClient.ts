import { GrammarlyLanguageClient } from 'grammarly-languageclient'
import { Disposable, env, ExtensionContext, StatusBarAlignment, Uri, window, workspace } from 'vscode'
import { Registerable } from './interfaces'

export class GrammarlyClient implements Registerable {
  public client: GrammarlyLanguageClient
  private session?: Disposable
  private callbacks = new Set<() => unknown>()
  private isReady = false

  constructor(private readonly context: ExtensionContext) {
    this.client = this.createClient()
  }

  public onReady(fn: () => unknown): Disposable {
    this.callbacks.add(fn)
    if (this.isReady) fn()
    return new Disposable(() => this.callbacks.delete(fn))
  }

  private createClient(): GrammarlyLanguageClient {
    const config = workspace.getConfiguration('grammarly')

    const documentSelector = [
      ...(config.get<string[]>('patterns')?.map((pattern) => ({ scheme: 'file', pattern })) ?? []),
      ...(config.get<any[]>('selectors')?.filter((item) => Object.keys(item).length > 0) ?? []),
    ]

    const client = new GrammarlyLanguageClient(
      this.context.asAbsolutePath(
        `dist/server/index.${
          // @ts-ignore
          typeof navigator === 'undefined' ? 'node' : 'browser'
        }.js`,
      ),
      {
        id: 'client_BaDkMgx4X19X9UxxYRCXZo',
        name: 'Grammarly',
        documentSelector: documentSelector,
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
      client.onNotification('$/openOAuthUrl', (url: string) => {
        env.openExternal(Uri.parse(url))
      })
    })

    return client
  }

  register() {
    workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('grammarly.patterns') || event.affectsConfiguration('grammarly.selectors')) {
        await this.restart()
      }
    })

    return Disposable.from(
      window.registerUriHandler({
        handleUri: (uri) => {
          if (uri.path === '/auth/callback') {
            this.client.sendNotification('$/handleOAuthUrl', uri.toString())
          }
        },
      }),
      { dispose: () => this.session?.dispose() },
    )
  }

  public async restart(): Promise<void> {
    const statusbar = window.createStatusBarItem(StatusBarAlignment.Left, Number.MIN_SAFE_INTEGER)
    statusbar.text = '$(sync~spin) Starting Grammarly language server'
    statusbar.show()
    try {
      this.session?.dispose()
      this.client = this.createClient()
      this.session = this.client.start()
      await this.client.onReady()
      this.isReady = true
      this.callbacks.forEach((fn) => fn())
    } finally {
      statusbar.dispose()
    }
  }
}
