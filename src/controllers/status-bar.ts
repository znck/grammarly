import { GrammarlyClient } from '@/client';
import { Registerable } from '@/interfaces';
import { Grammarly } from '@/server/grammarly';
import { injectable } from 'inversify';
import {
  Disposable,
  StatusBarAlignment,
  StatusBarItem,
  TextEditor,
  ThemeColor,
  window,
  workspace,
  TextDocument,
} from 'vscode';
import { DocumentSummary } from '@/protocol';

@injectable()
export class StatusBarController implements Registerable {
  private readonly statusBar: StatusBarItem = window.createStatusBarItem(
    StatusBarAlignment.Left
  );

  private activeDocument?: string;

  constructor(private readonly client: GrammarlyClient) {
    this.statusBar.text = '$(globe) ...';
    this.statusBar.tooltip = 'Waiting for grammarly.com';
    this.statusBar.color = new ThemeColor('statusBar.foreground');
  }

  register() {
    this.client.onReady().then(() => {
      this.client.onEvent(Grammarly.Action.FEEDBACK, this.update.bind(this));
      this.client.onEvent(Grammarly.Action.FINISHED, this.update.bind(this));
      this.onDidChangeActiveTextEditor(window.activeTextEditor);
    });

    return Disposable.from(
      this.statusBar,
      window.onDidChangeActiveTextEditor(
        this.onDidChangeActiveTextEditor.bind(this)
      ),
      workspace.onDidOpenTextDocument(this.onDidOpenTetDocument.bind(this))
    );
  }

  onDidOpenTetDocument() {
    this.update();
  }

  private onDidChangeActiveTextEditor(editor?: TextEditor) {
    if (!editor) {
      if (
        this.activeDocument &&
        !window.visibleTextEditors.find(
          editor => editor.document.uri.toString() === this.activeDocument
        )
      ) {
        this.activeDocument = undefined;
      }
    } else if (!this.client.isIgnoredDocument(editor.document)) {
      this.activeDocument = editor.document.uri.toString();
    } else if (editor.document.uri.scheme !== 'output') {
      this.activeDocument = undefined;
    }

    this.update();
  }

  private async update() {
    if (!this.activeDocument) {
      this.statusBar.hide();
      return;
    }

    this.statusBar.text = '$(globe) ...';
    this.statusBar.tooltip = 'Waiting for grammarly.com';
    this.statusBar.command = 'grammarly.stats';
    this.statusBar.show();

    const summary = await this.client.getSummary(this.activeDocument!);

    if (summary) {
      this.setTooltip(summary);
      this.setStatusText(summary);
    } else {
      this.statusBar.tooltip = 'Grammarly status not available.';
      this.statusBar.text = '$(globe)';
    }

    this.statusBar.show();
  }

  private setStatusText({ overall: score, username }: DocumentSummary) {
    this.statusBar.text =
      '$(globe)' + (username ? ' ' + username : '') + ' (' + score + '/100)';
  }

  private setTooltip({ scores: status, username }: DocumentSummary) {
    const v = (num: number) => Number.parseInt(`${num * 100}`);

    this.statusBar.tooltip = status
      ? [
          `Clarity: ${v(status.Clarity)}`,
          `Correctness: ${v(status.Correctness)}`,
          `Engagement: ${v(status.Engagement)}`,
          `Tone: ${v(status.Tone)}`,
        ].join('\n')
      : '';
    if (username) {
      this.statusBar.tooltip =
        `Loggedin as **${username}**\n\n` + this.statusBar.tooltip;
    }
  }
}
