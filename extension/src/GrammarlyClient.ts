import { GrammarlyLanguageClient } from 'grammarly-languageclient'
import {
  commands,
  Disposable,
  DocumentFilter,
  env,
  ExtensionContext,
  languages,
  RelativePattern,
  StatusBarAlignment,
  TextDocument,
  Uri,
  window,
  workspace,
} from 'vscode'
import { Registerable } from './interfaces'

export class GrammarlyClient implements Registerable {
  public client!: GrammarlyLanguageClient
  private session?: Disposable
  private callbacks = new Set<() => unknown>()
  private isReady = false
  private selectors: DocumentFilter[] = []

  constructor(private readonly context: ExtensionContext) {}

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
    const folder = workspace.workspaceFolders?.[0]
    this.selectors = []
    config.get<string[]>('patterns', []).forEach((pattern) => {
      this.selectors.push({
        scheme: 'file',
        pattern: folder != null ? new RelativePattern(folder, pattern) : pattern,
      })
    })
    config.get<DocumentFilter[]>('selectors', []).forEach((selector) => {
      if (folder != null && selector.pattern != null) {
        this.selectors.push({
          ...selector,
          pattern: new RelativePattern(folder, String(selector.pattern)),
        })
      } else {
        this.selectors.push(selector)
      }
    })

    const client = new GrammarlyLanguageClient(
      isNode()
        ? this.context.asAbsolutePath(`dist/server/index.node.js`)
        : Uri.joinPath(this.context.extensionUri, `dist/server/index.browser.js`).toString(),
      {
        id: 'client_BaDkMgx4X19X9UxxYRCXZo',
        name: 'Grammarly',
        outputChannel: window.createOutputChannel('Grammarly'),
        documentSelector: this.selectors
          .map((selector) =>
            selector.language != null || selector.pattern != null || selector.scheme != null ? (selector as any) : null,
          )
          .filter(<T>(value: T | null): value is T => value != null),
        initializationOptions: {
          startTextCheckInPausedState: config.get<boolean>('startTextCheckInPausedState'),
        },
        revealOutputChannelOn: 3,
        progressOnInitialization: true,
        errorHandler: {
          error(error) {
            window.showErrorMessage(error.message)
            return 2
          },
          closed() {
            return 1
          },
        },
        markdown: {
          isTrusted: true,
        },
      },
    )

    return client
  }

  register() {
    return Disposable.from(
      window.registerUriHandler({
        handleUri: async (uri) => {
          if (uri.path === '/auth/callback') {
            try {
              await this.client.protocol.handleOAuthCallbackUri(uri.toString(true))
            } catch (error) {
              await window.showErrorMessage((error as Error).message)
              return
            }

            if (await this.client.protocol.isUserAccountConnected()) {
              await window.showInformationMessage('Account connected.')
            }
          } else {
            throw new Error(`Unexpected URI: ${uri.toString()}`)
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
          const action = await window.showInformationMessage(
            `Grammarly is not enabled for this file. Enable now?`,
            {
              modal: true,
              detail: [
                `- Scheme: ${document.uri.scheme}`,
                `- Language: ${document.languageId}`,
                `- Path: ${workspace.asRelativePath(document.uri)}`,
              ].join('\n'),
            },

            'Current file',
            `All ${document.languageId} files`,
          )

          if (action != null) {
            const workspaceConfig = workspace.getConfiguration('grammarly')
            const workspaceSelectors = workspaceConfig.get<DocumentFilter[]>('selectors', [])
            const selector: DocumentFilter = {
              language: document.languageId,
              scheme: document.uri.scheme,
              pattern: action === 'Current file' ? workspace.asRelativePath(document.uri) : undefined,
            }
            const selectors = [...workspaceSelectors, selector]
            await workspaceConfig.update('selectors', selectors, false)
            await this.start()
          }
        }
      }),
      commands.registerCommand('grammarly.dismiss', async (options: any) => {
        await this.client.protocol.dismissSuggestion(options)
      }),
      commands.registerCommand('grammarly.login', async () => {
        const internalRedirectUri = Uri.parse(`${env.uriScheme}://znck.grammarly/auth/callback`, true)
        const externalRedirectUri = await env.asExternalUri(internalRedirectUri)

        const isExternalURLDifferent = internalRedirectUri.toString(true) === externalRedirectUri.toString(true)
        const redirectUri = isExternalURLDifferent
          ? internalRedirectUri.toString(true)
          : 'https://vscode-extension-grammarly.netlify.app/.netlify/functions/redirect'
        const url = new URL(await this.client.protocol.getOAuthUrl(redirectUri))
        url.searchParams.set('state', toBase64URL(externalRedirectUri.toString(true)))

        if (!(await env.openExternal(Uri.parse(url.toString(), true)))) {
          await window.showErrorMessage('Failed to open login page.')
        }
      }),
      commands.registerCommand('grammarly.logout', async () => {
        await this.client.protocol.logout()
        await window.showInformationMessage('Logged out.')
      }),
      { dispose: () => this.session?.dispose() },
    )
  }

  public async start(): Promise<void> {
    const statusbar = window.createStatusBarItem(StatusBarAlignment.Left, Number.MIN_SAFE_INTEGER)
    statusbar.text = `$(sync~spin) ${this.session == null ? 'Starting' : 'Restarting'} Grammarly language server`
    statusbar.show()
    try {
      this.session?.dispose()
      this.client = this.createClient()
      this.session = this.client.start()
      await this.client.onReady()
      await commands.executeCommand('setContext', 'grammarly.isRunning', true)
      this.isReady = true
      this.callbacks.forEach((fn) => {
        try {
          fn()
        } catch (error) {
          console.error(error)
        }
      })
    } catch (error) {
      await commands.executeCommand('setContext', 'grammarly.isRunning', false)
      await window.showErrorMessage(`The extension couldn't be started. See the output channel for details.`)
    } finally {
      statusbar.dispose()
    }
  }
}

function isNode(): boolean {
  return typeof process !== 'undefined' && process.versions?.node != null
}

function toBase64URL(text: string): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(text, 'utf-8').toString('base64url')
  return btoa(text).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
