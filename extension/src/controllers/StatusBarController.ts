import { ref } from '@vue/reactivity'
import { injectable } from 'inversify'
import { GrammarlyLanguageServer } from 'unofficial-grammarly-language-server'
import { Disposable, StatusBarAlignment, StatusBarItem, TextEditor, ThemeColor, Uri, window, workspace } from 'vscode'
import { GrammarlyClient } from '../client'
import { Registerable } from '../interfaces'
import { DEFAULT, GrammarlySettings } from '../settings'
import { asText, calculateTime, capitalize, choose, formatLines } from '../utils/string'
import { watchEffect } from '../utils/watch'

type State = GrammarlyLanguageServer.DocumentState

@injectable()
export class StatusBarController implements Registerable {
  private readonly goalsBar: StatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left)
  private readonly statusBar: StatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left)

  private state = ref<State | null>(null)
  private document = ref<{ uri: string } | null>(null)

  constructor (private readonly client: GrammarlyClient) {
    this.statusBar.text = '$(globe) Enable Grammarly'
    this.statusBar.tooltip = 'Check grammar with Grammarly'
    this.statusBar.color = new ThemeColor('statusBar.foreground')
  }

  register() {
    this.client.onReady().then(() => {
      this.client.grammarly.onRequest(GrammarlyLanguageServer.Client.Feature.updateDocumentState, async (state) => {
        if (this.document.value?.uri === state?.uri) {
          this.state.value = await this.client.getDocumentState(state.uri)
          this.document.value = { uri: state.uri }
        }
      })

      this.onDidChangeActiveTextEditor(window.activeTextEditor)
    })

    return Disposable.from(
      this.statusBar,
      this.goalsBar,
      window.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditor.bind(this)),
      workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('grammarly')) {
          this.update()
        }
      }),
      {
        dispose: watchEffect(() => {
          this.update()
        }),
      },
    )
  }

  private getSettings(): GrammarlySettings {
    const uri = this.document.value != null ? Uri.parse(this.document.value.uri) : undefined
    const config = workspace.getConfiguration(undefined, uri)

    return config.get<GrammarlySettings>('grammarly') ?? DEFAULT
  }

  private update() {
    const state = this.state.value
    const document = this.document.value

    if (state != null && 'status' in state) {
      const prefix = state.emotions.length ? state.emotions[0].emoji : ``

      const settings = this.getSettings()
      this.statusBar.command = 'grammarly.stop'
      this.statusBar.text = `${state.status === 'CHECKING' ? '$(loading~spin)' : '$(debug-disconnect)'}${settings.showUsernameInStatusBar ? ` ${state.user.username}` : ''}`

      this.statusBar.tooltip = `${state.status === 'IDLE' ? 'Grammarly is checking for grammar errors.\n\n' : ''
        }Connected as ${state.user.username}, click to disconnect.`

      this.goalsBar.command = 'grammarly.setGoals'
      this.goalsBar.text = `${prefix} ${state.score > 0 ? `${state.score} overall score` : ''}`
      this.goalsBar.tooltip = asText(
        [
          this.getScoreSummary(state),
          this.getTextStats(state),
          this.getScores(state),
          this.getEmotions(state),
          '\nClick to set goals.\n',
          this.getUpgradeTooltip(state),
        ],
        '\n',
      )

      this.goalsBar.show()
      this.statusBar.show()
    } else if (document) {
      this.statusBar.command = 'grammarly.check'
      this.statusBar.text = '$(globe) Enable Grammarly'
      this.statusBar.tooltip = 'Check grammar with Grammarly'

      this.statusBar.show()
      this.goalsBar.hide()
    } else {
      this.statusBar.hide()
      this.goalsBar.hide()
    }
  }

  private getUpgradeTooltip(state: GrammarlyLanguageServer.DocumentState): string {
    return state != null && 'status' in state
      ? formatLines(
        (state.totalAlertsCount - state.premiumAlertsCount
          ? `There are ${state.totalAlertsCount - state.premiumAlertsCount} (of ${state.totalAlertsCount
          }) auto-fixable ${choose(state.totalAlertsCount - state.premiumAlertsCount, 'issue', 'issues')}. `
          : '') + this.getUpgradeMessage(state),
        35,
      )
      : ''
  }

  private getUpgradeMessage(state: GrammarlyLanguageServer.DocumentState): string {
    if (state == null || !('status' in state)) return ''
    if (state.premiumAlertsCount == 0) return ''
    if (state.user.isPremium === true) return ''

    if (state.user.isAnonymous) {
      return `Login to fix ${state.premiumAlertsCount} premium ${choose(
        state.premiumAlertsCount,
        'issue',
        'issues',
      )}. Run command - "Grammarly: Login to grammarly.com"`
    } else {
      return `Upgrade your Grammarly account to fix ${state.premiumAlertsCount} premium ${choose(
        state.premiumAlertsCount,
        'issue',
        'issues',
      )}.`
    }
  }

  private getScoreSummary(state: GrammarlyLanguageServer.DocumentState): string {
    if (state != null && 'status' in state && state.score > 0) {
      return [
        `Overall score ${state.score}\n`,
        formatLines(
          `This score represents the quality of writing in this document. ` +
          (state.score < 100
            ? (state.textInfo?.messages?.assistantHeader ? state.textInfo?.messages?.assistantHeader + '. ' : '') +
            `You can increase it by addressing Grammarly's suggestions.`
            : ''),
          35,
        ),
      ].join('\n')
    }

    return ''
  }

  private getEmotions(state: GrammarlyLanguageServer.DocumentState) {
    return state != null && 'status' in state && state.emotions.length > 0
      ? [
        `\nHere’s how your text sounds:`,
        state.emotions.map(
          (emotion) => ` ${emotion.emoji} ${capitalize(emotion.name)} ${~~(emotion.confidence * 100)}%`,
        ),
      ]
        .flat()
        .join('\n')
      : ''
  }

  private getTextStats(state: GrammarlyLanguageServer.DocumentState) {
    return state != null && 'status' in state && state.textInfo != null
      ? [`\nDocument summary:`, ...this.getTextStatesAsMessages(state).map((message) => ` ‣ ${message}`)].join('\n')
      : ''
  }

  private getTextStatesAsMessages(state: GrammarlyLanguageServer.DocumentState): string[] {
    return state != null && 'status' in state && state.textInfo != null
      ? [
        `${state.textInfo.wordsCount} ${choose(state.textInfo.wordsCount, 'word', 'words')}`,
        `${state.textInfo.charsCount} ${choose(state.textInfo.wordsCount, 'character', 'characters')}`,
        `${calculateTime(state.textInfo.wordsCount, 250)} reading time`,
        `${calculateTime(state.textInfo.wordsCount, 130)} speaking time`,
        `${state.textInfo.readabilityScore} readability score`,
      ]
      : []
  }

  private getScores(state: GrammarlyLanguageServer.DocumentState): string {
    if (state != null && 'status' in state) {
      const scores = Array.from(Object.entries(state.scores))
      return scores.length > 0
        ? [
          '\nOutcomes:',
          ...scores.map(([key, value]) => ` ‣ ${key.replace(/[A-Z]/g, (w) => ' ' + w).trim()} — ${~~(value! * 100)}`),
        ].join('\n')
        : ''
    }

    return ''
  }

  private async onDidChangeActiveTextEditor(editor: TextEditor | undefined): Promise<void> {
    if (!editor || !editor.document) return

    if (!this.client.isIgnoredDocument(editor.document.uri.toString(), editor.document.languageId)) {
      this.document.value = { uri: editor.document.uri.toString() }
      this.state.value = await this.client.getDocumentState(editor.document.uri.toString())
    } else {
      this.document.value = null
      this.state.value = null
    }
  }
}
