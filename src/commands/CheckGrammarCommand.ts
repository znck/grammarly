import { GrammarlyClient } from '@/client';
import { Registerable } from '@/interfaces';
import { injectable } from 'inversify';
import { commands, window, Disposable } from 'vscode';

@injectable()
export class CheckCommand implements Registerable {
  constructor(private readonly client: GrammarlyClient) {}

  register() {
    return Disposable.from(
      commands.registerCommand('grammarly.check', this.execute.bind(this)),
      commands.registerCommand('grammarly.stop', this.execute.bind(this, true))
    );
  }

  private async execute(stop: boolean = false) {
    if (!this.client.isReady()) return;

    if (!window.activeTextEditor) {
      window.showInformationMessage('No active text document found.');

      return;
    }

    const document = window.activeTextEditor.document;

    if (this.client.isIgnoredDocument(document)) {
      const ext = document.fileName.substr(document.fileName.lastIndexOf('.'));
      window.showInformationMessage(`The ${ext} filetype is not supported.`);
      // TODO: Add a button to create github issue.
      return;
    }

    if (stop) {
      await this.client.check(document.uri.toString());
    } else {
      await this.client.check(document.uri.toString());
    }
  }
}
