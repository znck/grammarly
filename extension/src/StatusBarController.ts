import { commands, Disposable, StatusBarAlignment, window, workspace } from 'vscode'
import { GrammarlyClient } from './GrammarlyClient'

type Status = 'idle' | 'connecting' | 'checking' | 'error'

export class StatusBarController {
  #statuses = new Map<string, Status>()
  #statusbar = window.createStatusBarItem(StatusBarAlignment.Right, Number.MIN_SAFE_INTEGER)

  constructor(private readonly grammarly: GrammarlyClient) {
    grammarly.onReady(() => {
      grammarly.client.onNotification('$/grammarlyCheckingStatus', (params: { uri: string; status: Status }) => {
        this.#statuses.set(params.uri, params.status)
        this.update()
      })
    })
  }

  register() {
    this.update()
    return Disposable.from(
      this.#statusbar,
      workspace.onDidCloseTextDocument(({ uri }) => {
        this.#statuses.delete(uri.toString())
        this.update()
      }),
      window.onDidChangeActiveTextEditor(() => this.update()),
      commands.registerCommand('grammarly.restartServer', async () => {
        await this.grammarly.restart()
      }),
    )
  }

  update(): void {
    const id = window.activeTextEditor?.document.uri.toString()
    if (id == null) return this.#statusbar.hide()
    const status = this.#statuses.get(id)
    if (status == null) return this.#statusbar.hide()
    this.#statusbar.text =
      status === 'connecting'
        ? '$(sync~spin)'
        : status === 'error'
        ? '$(warning)'
        : status === 'idle'
        ? '$(pass-filled)'
        : '$(loading~spin)'
    this.#statusbar.color = ''
    this.#statusbar.accessibilityInformation = {
      label: status,
      role: status === 'error' ? 'button' : undefined,
    }
    this.#statusbar.tooltip = `Grammarly is ${status}.`
    this.#statusbar.command = status === 'error' ? 'grammarly.restartServer' : undefined
    this.#statusbar.show()
  }
}
