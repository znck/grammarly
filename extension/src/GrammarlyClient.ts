import { GrammarlyLanguageClient } from 'unofficial-grammarly-language-client'
import { commands, Disposable, env, ExtensionContext, Uri, window, workspace } from 'vscode'
import { Registerable } from './interfaces'

export class GrammarlyClient implements Registerable {
  public client: GrammarlyLanguageClient
  private session?: Disposable

  constructor(private readonly context: ExtensionContext) {
    this.client = this.createClient()
  }

  private createClient(): GrammarlyLanguageClient {
    const config = workspace.getConfiguration('grammarly')

    const documentSelector = [
      ...(config.get<string[]>('patterns')?.map((pattern) => ({ pattern })) ?? []),
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
      client.onNotification('openOAuthUrl', (url: string) => {
        env.openExternal(Uri.parse(url))
      })
    })

    return client
  }

  register() {
    this.session = this.client.start()

    workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('grammarly.patterns') || event.affectsConfiguration('grammarly.selectors')) {
        this.session?.dispose()
        this.client = this.createClient()
        this.session = this.client.start()
      }
    })

    return Disposable.from(
      window.registerUriHandler({
        handleUri: (uri) => {
          if (uri.path === '/auth/callback') {
            this.client.sendNotification('handleOAuthUrl', uri.toString())
          }
        },
      }),
      { dispose: () => this.session?.dispose() },
    )
  }
}
