import { EXTENSION } from '@/constants';
import { Registerable } from '@/interfaces';
import { GrammarlyLanguageServer } from '@/protocol';
import { inject, injectable } from 'inversify';
import keytar from 'keytar';
import minimatch from 'minimatch';
import { ExtensionContext, TextDocument, window, workspace } from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { TextEdit } from 'vscode-languageserver-textdocument';
import { getLanguageClientOptions, getLanguageServerOptions, LANGUAGES } from './options';

@injectable()
export class GrammarlyClient implements Registerable {
  public readonly grammarly: LanguageClient;

  constructor(@inject(EXTENSION) context: ExtensionContext) {
    this.grammarly = new LanguageClient(
      'grammarly',
      'Grammarly',
      getLanguageServerOptions(context.asAbsolutePath('out/server.js')),
      getLanguageClientOptions()
    );
  }

  private _isReady = false;

  register() {
    const disposable = this.grammarly.start();

    this.grammarly.onReady().then(() => {
      this._isReady = true;
      this.grammarly.onRequest('$/credentials', async () => {
        if (process.env.EXTENSION_TEST_MODE) return;

        const credentials = (await keytar.findCredentials('vscode-grammarly')) || [];

        return credentials.length
          ? {
              username: credentials[0].account,
              password: credentials[0].password,
            }
          : undefined;
      });

      this.grammarly.onRequest('$/getCookie', async () => {
        if (process.env.EXTENSION_TEST_MODE) return;

        const content = await keytar.findPassword('vscode-grammarly-cookie');

        if (content) return JSON.parse(content);
      });

      this.grammarly.onRequest('$/setCookie', (cookie: any) => {
        if (cookie) {
          keytar.setPassword('vscode-grammarly-cookie', 'default', JSON.stringify(cookie));
        } else {
          keytar.deletePassword('vscode-grammarly-cookie', 'default');
        }
      });

      this.grammarly.onRequest('$/error', (error, buttons) => {
        const actions = Array.from(buttons).filter(Boolean).map(String);
        if (!error) return;
        return window.showErrorMessage('Grammarly: ' + error, ...actions);
      });
    });

    return disposable;
  }

  get onReady() {
    return this.grammarly.onReady.bind(this.grammarly);
  }

  isReady() {
    if (!this._isReady) {
      window.showInformationMessage(`Grammarly server is not ready yet.`);

      return false;
    }

    return true;
  }

  isIgnoredDocument(document: TextDocument) {
    const uri = document.uri.toString();
    const ignore = workspace.getConfiguration('grammarly', document.uri).get<string[]>('ignore') || [];
    const isIgnored = !LANGUAGES.includes(document.languageId) || ignore.some((pattern) => minimatch(uri, pattern));
    return isIgnored;
  }

  async getDocumentState(uri: string) {
    return this.grammarly.sendRequest(GrammarlyLanguageServer.Feature.getDocumentState, { uri });
  }

  async sendFeedback(method: string, params: any) {
    await this.grammarly.sendRequest(method, params);
  }

  async check(uri: string) {
    await this.grammarly.sendRequest(GrammarlyLanguageServer.Feature.checkGrammar, { uri });
  }

  async stopCheck(uri: string) {
    await this.grammarly.sendRequest(GrammarlyLanguageServer.Feature.stop, { uri });
  }

  async dismissAlert(uri: string, alertId: number) {
    await this.grammarly.sendRequest('$/dismissAlert', [uri, alertId]);
  }

  async addToDictionary(uri: string, alertId: number) {
    await this.grammarly.sendRequest('$/addToDictionary', [uri, alertId]);
  }
}
