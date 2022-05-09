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
      grammarly.client.protocol.onUserAccountConnectedChange(() => this.update())
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
    const isUser = await this.grammarly.client.protocol.isUserAccountConnected()
    const accountIcon = isUser ? '$(account)' : ''
    const statusIcon =
      status == null
        ? '$(sync)'
        : status === 'connecting'
        ? '$(sync~spin)'
        : status === 'error'
        ? accountIcon + '$(warning)'
        : status === 'idle'
        ? accountIcon + '$(pass-filled)'
        : '$(loading~spin)'
    this.#statusbar.text = statusIcon
    this.#statusbar.color = status === 'error' ? 'red' : ''
    this.#statusbar.accessibilityInformation = {
      label: status ?? '',
      role: status === 'error' ? 'button' : undefined,
    }

    this.#statusbar.tooltip = `Your Grammarly account is ${
      isUser ? '' : 'not '
    }used for this file. \nConnection status: ${status}`
    this.#statusbar.command = status === 'error' ? 'grammarly.restartServer' : undefined
    this.#statusbar.show()
  }
}
