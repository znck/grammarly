import { GrammarlyClient } from '@/client';
import { Registerable } from '@/interfaces';
import { DocumentSummary, ServiceStatus } from '@/protocol';
import { injectable } from 'inversify';
import { Disposable, StatusBarAlignment, StatusBarItem, TextEditor, ThemeColor, window } from 'vscode';

@injectable()
export class StatusBarController implements Registerable {
  private readonly statusBar: StatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);

  private currentDocument?: string;
  private currentSummary?: DocumentSummary;

  constructor(private readonly client: GrammarlyClient) {
    this.statusBar.text = '$(globe) ...';
    this.statusBar.tooltip = 'Waiting for grammarly.com';
    this.statusBar.color = new ThemeColor('statusBar.foreground');
  }

  register() {
    this.client.onReady().then(() => {
      this.client.onEvent('$/summary', this.onSummary.bind(this));
      this.onDidChangeActiveTextEditor(window.activeTextEditor);
    });

    return Disposable.from(
      this.statusBar,
      window.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditor.bind(this))
    );
  }

  private onSummary(uri: string, summary: DocumentSummary) {
    if (uri === this.currentDocument) {
      this.currentSummary = summary;
      this.updateStatusBar(summary);
    }
  }

  private onDidChangeActiveTextEditor(editor?: TextEditor) {
    if (!editor) return;
    const previousDocument = this.currentDocument;
    if (!this.client.isIgnoredDocument(editor.document)) {
      this.currentDocument = editor.document.uri.toString();
    } else {
      this.currentDocument = undefined;
    }

    if (previousDocument !== this.currentDocument) {
      this.currentSummary = undefined;
      this.update();
    }
  }

  private async update() {
    if (!this.currentDocument) {
      this.currentSummary = undefined;
      this.statusBar.hide();
      return;
    }

    this.updateStatusBar(this.currentSummary);
    this.statusBar.show();

    this.currentSummary = await this.client.getSummary(this.currentDocument!);
    this.updateStatusBar(this.currentSummary);
    this.statusBar.show();
  }

  private updateStatusBar(summary?: DocumentSummary) {
    if (!summary) {
      this.statusBar.text = '$(globe) ...';
      this.statusBar.tooltip = '';
      this.statusBar.command = '';
      this.statusBar.color = undefined;
      return;
    }

    const v = (num: number) => (typeof num !== 'number' ? 0 : Number.parseInt(`${num * 100}`));
    switch (summary.status) {
      case ServiceStatus.INACTIVE:
        this.statusBar.text = '$(globe) check grammar';
        this.statusBar.tooltip = 'Check grammar errors';
        this.statusBar.command = 'grammarly.check';
        this.statusBar.color = undefined;
        break;
      case ServiceStatus.CONNECTING:
        this.statusBar.text = '$(globe) connecting';
        this.statusBar.tooltip = '';
        this.statusBar.command = '';
        this.statusBar.color = undefined;
        break;
      case ServiceStatus.ERRORED:
        this.statusBar.text = '$(globe) retry grammar check';
        this.statusBar.tooltip = 'Recheck grammar errors';
        this.statusBar.command = 'grammarly.check';
        this.statusBar.color = new ThemeColor('errorForeground');
        break;
      case ServiceStatus.READY:
      case ServiceStatus.WAITING:
        this.statusBar.text = [
          '$(globe)',
          summary.username || 'anonymous',
          summary.status === ServiceStatus.WAITING
            ? 'calculating...'
            : summary.overall < 0
            ? '(too short)'
            : `(${summary.overall}/100)`,
        ]
          .filter(Boolean)
          .join(' ');
        this.statusBar.tooltip = [
          summary.overall < 0
            ? 'Write away! Grammarly needs at least 30 words to calculate document statistics.'
            : [
                `Performance: ${summary.overall}`,
                '',
                `Clarity: ${v(summary.scores?.Clarity)}`,
                `Correctness: ${v(summary.scores?.Correctness)}`,
                `Engagement: ${v(summary.scores?.Engagement)}`,
                `Tone: ${v(summary.scores?.Tone)}`,
              ].join('\n'),
          '',
          summary.username ? `Connected using ${summary.username} account.` : 'Connected anonymously.',
        ].join('\n');
        this.statusBar.command = 'grammarly.stats';
        this.statusBar.color = undefined;
        break;
    }
  }
}
