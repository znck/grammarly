import minimatch from 'minimatch'
// @ts-ignore
import { Disposable, LanguageClient } from 'vscode-languageclient'
import { GrammarlyLanguageServer } from '../../grammarly-language-server/src/protocol'
import { GrammarlyLanguageClientOptions } from './GrammarlyLanguageClientOptions'
import { getLanguageClientOptions, getLanguageServerOptions, LANGUAGES } from './options'

export class GrammarlyLanguageClient {
  public readonly grammarly: LanguageClient

  constructor(private readonly serverPath: string, private readonly options: GrammarlyLanguageClientOptions) {
    this.grammarly = new LanguageClient(
      'grammarly',
      'Grammarly',
      getLanguageServerOptions(this.serverPath),
      getLanguageClientOptions(),
    )
  }

  private _isReady = false

  start(): Disposable {
    const disposable = this.grammarly.start()

    this.grammarly.onReady().then(() => {
      this._isReady = true

      this.grammarly.onRequest('$/credentials', this.options.getCredentials)
      this.grammarly.onRequest('$/getCookie', async () => {
        const content = this.options.loadToken != null ? await this.options.loadToken() : null

        if (content != null) return JSON.parse(content)
      })

      this.grammarly.onRequest('$/setCookie', async (cookie: any) => {
        if (this.options.saveToken != null) await this.options.saveToken(cookie != null ? JSON.stringify(cookie) : null)
      })

      this.grammarly.onRequest('$/error', (error: string, buttons: string[]) => {
        const actions = Array.from(buttons).filter(Boolean).map(String)
        if (this.options.onError != null) {
          return this.options.onError(error, actions)
        } else {
          console.error(error)
          return
        }
      })
    })

    return disposable
  }

  get onReady(): () => Promise<void> {
    return this.grammarly.onReady.bind(this.grammarly)
  }

  isReady(): boolean {
    if (!this._isReady) {
      return false
    }

    return true
  }

  isIgnoredDocument(uri: string, languageId: string): boolean {
    const ignore = this.options.getIgnoredDocuments != null ? this.options.getIgnoredDocuments(uri) : []
    const isIgnored = !LANGUAGES.includes(languageId) || ignore.some((pattern) => minimatch(uri, pattern))

    return isIgnored
  }

  async getDocumentState(uri: string): Promise<GrammarlyLanguageServer.DocumentState | null> {
    return this.grammarly.sendRequest(GrammarlyLanguageServer.Feature.getDocumentState, { uri })
  }

  async sendFeedback(method: string, params: any): Promise<void> {
    await this.grammarly.sendRequest(method, params)
  }

  async check(uri: string): Promise<void> {
    await this.grammarly.sendRequest(GrammarlyLanguageServer.Feature.checkGrammar, { uri })
  }

  async stopCheck(uri: string): Promise<void> {
    await this.grammarly.sendRequest(GrammarlyLanguageServer.Feature.stop, { uri })
  }

  async dismissAlert(uri: string, alertId: number): Promise<void> {
    await this.grammarly.sendRequest('$/dismissAlert', [uri, alertId])
  }

  async addToDictionary(uri: string, alertId: number): Promise<void> {
    await this.grammarly.sendRequest('$/addToDictionary', [uri, alertId])
  }
}
