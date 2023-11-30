import { commands, Disposable, StatusBarAlignment, TextDocument, Uri, window, workspace } from 'vscode'
import { GrammarlyClient } from './GrammarlyClient'

type Status = 'idle' | 'connecting' | 'checking' | 'error' | 'paused'

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
    this.grammarly.onReady(() => this.update())

    let isRestarting = false
    return Disposable.from(
      this.#statusbar,
      workspace.onDidCloseTextDocument(() => this.update()),
      window.onDidChangeActiveTextEditor(() => this.update()),
      commands.registerCommand('grammarly.restartServer', async () => {
        if (isRestarting) return
        try {
          isRestarting = true
          await this.grammarly.start()
        } finally {
          isRestarting = false
        }
      }),
      commands.registerCommand('grammarly.pauseCheck', async (uri?: Uri) => {
        const id = uri ?? window.activeTextEditor?.document.uri
        if (id == null) return
        
        await this.grammarly.client.protocol.pause(id.toString())
        await this.update()
      }),
      commands.registerCommand('grammarly.resumeCheck', async (uri?: Uri) => {
        const id = uri ?? window.activeTextEditor?.document.uri
        if (id == null) return
        await this.grammarly.client.protocol.resume(id.toString())
        await this.update()
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
    const isUser = await this.grammarly.client.protocol.isUserAccountConnected()
    await commands.executeCommand('setContext', 'grammarly.isUserAccountConnected', isUser)
    if (document == null) return this.hide()
    const status = await this.getStatus(document)
    this.#current = { uri: document.uri.toString(), status }
    if (status == null && !this.grammarly.matchesDocumentSelector(document)) return this.hide()
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
        : status === 'paused'
        ? '$(debug-start)'
        : '$(loading~spin)'
    this.#statusbar.text = statusIcon
    this.#statusbar.color = status === 'error' ? 'red' : ''
    this.#statusbar.accessibilityInformation = {
      label: status ?? '',
      role: 'button',
    }

    this.#statusbar.tooltip = [
      `Your Grammarly account is ${isUser ? '' : 'not '}used for this file.`,
      `Connection status: ${status}`,
      status === 'error' ? `Restart now?` : null,
      status === 'paused' ? `Resume text checking?` : null,
    ]
      .filter(Boolean)
      .join('\n')
    this.#statusbar.command =
      status === 'error'
        ? { title: 'Restart', command: 'grammarly.restartServer' }
        : status === 'paused'
        ? { title: 'Resume', command: 'grammarly.resumeCheck', arguments: [document.uri] }
        : { title: 'Pause', command: 'grammarly.pauseCheck', arguments: [document.uri] }
    this.#statusbar.show()
    await commands.executeCommand('setContext', 'grammarly.isActive', true)
    await commands.executeCommand('setContext', 'grammarly.isPaused', status === 'paused')
  }

  private async hide() {
    this.#statusbar.hide()
    await commands.executeCommand('setContext', 'grammarly.isActive', false)
  }
}
