import { getGrammarlyClient } from '@/client';
import { commands } from 'vscode';
import { Disposable } from 'vscode-languageclient';

export function registerIgnoreWordCommand(): Disposable {
  return commands.registerCommand(
    'grammarly.ignoreIssue',
    async (resource: string, alertId: number) => {
      await getGrammarlyClient().dismissAlert(resource, alertId);
    }
  );
}
