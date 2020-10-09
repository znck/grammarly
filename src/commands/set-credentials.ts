import { Registerable } from '@/interfaces';
import { injectable } from 'inversify';
import { commands, window } from 'vscode';
import keytar from 'keytar';
import { AuthParams } from '@/server/socket';
import { authenticate } from '@/server/grammarly/auth';
import { form, input } from '@/form';

@injectable()
export class SetCredentialsCommand implements Registerable {
  register() {
    return commands.registerCommand('grammarly.setCredentials', this.execute.bind(this));
  }

  private async execute() {
    const credentials = await keytar.findCredentials('vscode-grammarly');
    const currentData: AuthParams = { username: '', password: '' };

    if (credentials.length) {
      currentData.username = credentials[0].account;
      currentData.password = credentials[0].password;
    }

    const newData = await form<AuthParams>('Login to grammarly.com', [
      input('username', 'Username', {
        placeholder: 'username',
        value: currentData.username,
      }),
      input('password', 'Password', {
        placeholder: 'password',
        validate: async (password, { username }) => {
          await authenticate(username, password);
        },
        value: currentData.password,
      }),
    ]).run();

    if (newData) {
      keytar.setPassword('vscode-grammarly', newData.username, newData.password);
      window.showInformationMessage(`Logged in to grammarly.com as ${newData.username}.`);
    }
  }
}
