import { GrammarlyClient } from '@/client';
import { Registerable } from '@/interfaces';
import { injectable } from 'inversify';
import { commands } from 'vscode';
import { TextEdit } from 'vscode-languageserver-textdocument';

@injectable()
export class PostQuickFixCommand implements Registerable {
  constructor(private readonly client: GrammarlyClient) {}

  register() {
    return commands.registerCommand(
      'grammarly.postQuickFix',
      this.execute.bind(this)
    );
  }

  private async execute(uri: string, alertId: number, change: TextEdit) {
    if (!this.client.isReady()) return;

    this.client.onCodeActionAccepted(uri, alertId, change);
  }
}
