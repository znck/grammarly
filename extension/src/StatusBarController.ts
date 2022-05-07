import { commands, Disposable, StatusBarAlignment, TextDocument, window, workspace } from 'vscode'
import { GrammarlyClient } from './GrammarlyClient'

type Status = 'idle' | 'connecting' | 'checking' | 'error'

export class StatusBarController {
  #current: { uri: string; status: Status | null } | null = null
  #statusbar = window.createStatusBarItem(StatusBarAlignment.Right, Number.MIN_SAFE_INTEGER)

  constructor(private readonly grammarly: GrammarlyClient) {
    grammarly.onReady(() => {
      grammarly.client.protocol.onDocumentStatus(({ uri, status }) => {
        if (uri === this.#current?.uri) {
          this.#current.status = status
          this.update()
        }
      })
    })
  }

  public register() {
    this.update()
    return Disposable.from(
      this.#statusbar,
      workspace.onDidCloseTextDocument(() => this.update()),
      window.onDidChangeActiveTextEditor(() => this.update()),
      commands.registerCommand('grammarly.restartServer', async () => {
        // TODO: Restart?
      }),
    )
  }

  private async getStatus(document: TextDocument): Promise<Status | null> {
    const uri = document.uri.toString()
    return await this.grammarly.client.protocol.getDocumentStatus(uri)
  }

  public async update(): Promise<void> {
    await Promise.resolve()
    const document = window.activeTextEditor?.document
    if (document == null) return this.#statusbar.hide()
    const status = await this.getStatus(document)
    this.#current = { uri: document.uri.toString(), status }
    if (status == null && !this.grammarly.matchesDocumentSelector(document)) return this.#statusbar.hide()
    this.#statusbar.text =
      status == null
        ? '$(sync)'
        : status === 'connecting'
        ? '$(sync~spin)'
        : status === 'error'
        ? '$(warning)'
        : status === 'idle'
        ? '$(pass-filled)'
        : '$(loading~spin)'
    this.#statusbar.color = ''
    this.#statusbar.accessibilityInformation = {
      label: status ?? '',
      role: status === 'error' ? 'button' : undefined,
    }
    this.#statusbar.tooltip = `Grammarly is ${status ?? 'not connected'}.`
    this.#statusbar.command = status === 'error' ? 'grammarly.restartServer' : undefined
    this.#statusbar.show()
  }
}
