import { GrammarlyClient } from '@/client';
import { Registerable } from '@/interfaces';
import { GrammarlyLanguageServer } from '@/protocol';
import { asText, calculateTime, capitalize, choose, formatLines } from '@/utils/string';
import { watchEffect } from '@/utils/watch';
import { ref } from '@vue/reactivity';
import { injectable } from 'inversify';
import { Disposable, StatusBarAlignment, StatusBarItem, TextEditor, ThemeColor, window } from 'vscode';
import { GrammarlyStatus } from '@/server/grammarly/hosts/TextGrammarCheckHost';

interface State extends GrammarlyLanguageServer.DocumentState {}

@injectable()
export class StatusBarController implements Registerable {
  private readonly statusBar: StatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);

  private state = ref<State | null>(null);
  private texts: string[] = [];
  private index = 0;

  constructor(private readonly client: GrammarlyClient) {
    this.statusBar.text = '$(globe) Not checking';
    this.statusBar.tooltip = 'Check grammar with Grammarly';
    this.statusBar.color = new ThemeColor('statusBar.foreground');
  }

  register() {
    this.client.onReady().then(() => {
      this.client.grammarly.onRequest(GrammarlyLanguageServer.Client.Feature.updateDocumentState, (state) => {
        if (this.state.value?.uri === state.uri) {
          this.state.value = state;
        }
      });

      this.onDidChangeActiveTextEditor(window.activeTextEditor);
    });

    const id = setInterval(() => {
      this.index += 1;
      this.statusBar.text = this.texts[this.index >= this.texts.length ? 0 : this.index];
    }, 2000);

    return Disposable.from(
      this.statusBar,
      window.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditor.bind(this)),
      { dispose: () => clearInterval(id) },
      {
        dispose: watchEffect(() => {
          this.update();
        }),
      }
    );
  }

  private update() {
    const state = this.state.value;

    if (state) {
      this.index = 0;

      const prefix = state.emotions.length ? state.emotions[0].emoji : `$(globe)`;
      const upgradeMessage = this.getUpgradeMessage(state).trim().replace(/\n/g, ' ');

      this.texts = [
        state.score > 0 ? `${state.score} overall score` : '',
        upgradeMessage,
        upgradeMessage,
        upgradeMessage,
        state.status === GrammarlyStatus.CHECKING ? 'Checking...' : '',
        ...this.getTextStatesAsMessages(state),
      ]
        .filter(Boolean)
        .map((message) => `${prefix} ${message}`);

      this.statusBar.command = 'grammarly.setGoals';
      this.statusBar.text = this.texts[this.index];
      this.statusBar.tooltip = asText(
        [
          this.getScoreSummary(state),
          this.getTextStats(state),
          this.getScores(state),
          this.getEmotions(state),
          '\nClick to set goals.\n',
          this.getUpgradeTooltip(state),
        ],
        '\n'
      );

      this.statusBar.show();
    } else {
      this.statusBar.hide();
    }
  }

  private getUpgradeTooltip(state: GrammarlyLanguageServer.DocumentState) {
    return formatLines(
      (state.totalAlertsCount - state.premiumAlertsCount
        ? `There are ${state.totalAlertsCount - state.premiumAlertsCount} (of ${
            state.totalAlertsCount
          }) auto-fixable ${choose(state.totalAlertsCount - state.premiumAlertsCount, 'issue', 'issues')}. `
        : '') + this.getUpgradeMessage(state),
      35
    );
  }

  private getUpgradeMessage(state: GrammarlyLanguageServer.DocumentState) {
    return !state.user.isPremium && state.premiumAlertsCount
      ? `${state.user.isAnonymous ? 'Login' : 'Upgrade'} to fix ${state.premiumAlertsCount} premium ${choose(
          state.premiumAlertsCount,
          'issue',
          'issues'
        )}.${state.user.isAnonymous ? ' Run command - "Grammarly: Login"' : ''}`
      : '';
  }

  private getScoreSummary(state: GrammarlyLanguageServer.DocumentState): string {
    if (state.score > 0) {
      return [
        `Overall score ${state.score}\n`,
        formatLines(
          `This score represents the quality of writing in this document. ` +
            (state.score < 100
              ? (state.textInfo?.messages?.assistantHeader ? state.textInfo?.messages?.assistantHeader + '. ' : '') +
                `You can increase it by addressing Grammarly's suggestions.`
              : ''),
          35
        ),
      ].join('\n');
    }

    return '';
  }

  private getEmotions({ emotions }: GrammarlyLanguageServer.DocumentState) {
    return emotions.length
      ? [
          `\nHere’s how your text sounds:`,
          emotions.map((emotion) => ` ${emotion.emoji} ${capitalize(emotion.name)} ${~~(emotion.confidence * 100)}%`),
        ]
          .flat()
          .join('\n')
      : '';
  }

  private getTextStats(state: GrammarlyLanguageServer.DocumentState) {
    return state.textInfo
      ? [`\nDocument summary:`, ...this.getTextStatesAsMessages(state).map((message) => ` ‣ ${message}`)].join('\n')
      : '';
  }

  private getTextStatesAsMessages(state: GrammarlyLanguageServer.DocumentState) {
    return state.textInfo
      ? [
          `${state.textInfo.wordsCount} ${choose(state.textInfo.wordsCount, 'word', 'words')}`,
          `${state.textInfo.charsCount} ${choose(state.textInfo.wordsCount, 'character', 'characters')}`,
          `${calculateTime(state.textInfo.wordsCount, 250)} reading time`,
          `${calculateTime(state.textInfo.wordsCount, 130)} speaking time`,
          `${state.textInfo.readabilityScore} readability score`,
        ]
      : [];
  }

  private getScores(state: GrammarlyLanguageServer.DocumentState) {
    const scores = Array.from(Object.entries(state.scores));
    return scores.length
      ? [
          '\nOutcomes:',
          ...scores.map(([key, value]) => ` ‣ ${key.replace(/[A-Z]/g, (w) => ' ' + w).trim()} — ${~~(value! * 100)}`),
        ].join('\n')
      : '';
  }

  private async onDidChangeActiveTextEditor(editor: TextEditor | undefined) {
    if (!editor || !editor.document) return;

    if (!this.client.isIgnoredDocument(editor.document)) {
      this.state.value = await this.client.getDocumentState(editor.document.uri.toString());
    } else {
      this.state.value = null;
    }
  }
}
