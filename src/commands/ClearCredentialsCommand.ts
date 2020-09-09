import { Registerable } from '@/interfaces';
import { injectable } from 'inversify';
import keytar from 'keytar';
import { commands, window } from 'vscode';

@injectable()
export class ClearCredentialsCommand implements Registerable {
  register() {
    return commands.registerCommand('grammarly.clearCredentials', this.execute.bind(this));
  }

  private async execute() {
    for (const credentials of await keytar.findCredentials('vscode-grammarly')) {
      keytar.deletePassword('vscode-grammarly', credentials.account);
    }
    for (const credentials of await keytar.findCredentials('vscode-grammarly-cookie')) {
      keytar.deletePassword('vscode-grammarly-cookie', credentials.account);
    }
    window.showInformationMessage(`Logged out of grammarly.com.`);
  }
}
