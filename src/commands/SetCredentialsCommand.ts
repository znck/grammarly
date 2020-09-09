import { form, input } from '@/form';
import { AuthParams, Registerable } from '@/interfaces';
import { authenticate } from '@/server/grammarly/GrammarlyAuth';
import { injectable } from 'inversify';
import keytar from 'keytar';
import { commands, window, Disposable, UriHandler, Uri, env } from 'vscode';

@injectable()
export class AuthenticationService implements Registerable, UriHandler {
  register() {
    commands.executeCommand('setContext', 'grammarly:isAnonymous', true);

    return Disposable.from(
      commands.registerCommand('grammarly.setCredentials', this.execute.bind(this)),
      commands.registerCommand('grammarly.login', this.handleLogin.bind(this)),
      window.registerUriHandler(this)
    );
  }

  handleUri(uri: Uri) {
    if (uri.path === '/auth/callback') {
    }
  }

  handleLogin() {
    env.openExternal(Uri.parse('https://grammarly.com/login?source=extension'));
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
