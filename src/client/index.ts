import { EXTENSION } from '@/constants';
import minimatch from 'minimatch';
import { Registerable } from '@/interfaces';
import {
  DictionaryType,
  DocumentStatistics,
  DocumentSummary,
  GrammarlyServerFeatures,
  GrammarlyServerEvents,
} from '@/protocol';
import { inject, injectable } from 'inversify';
import { ExtensionContext, window, TextDocument, workspace } from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import {
  getLanguageClientOptions,
  getLanguageServerOptions,
  LANGUAGES,
} from './options';
import keytar from 'keytar';

@injectable()
export class GrammarlyClient implements Registerable, GrammarlyServerFeatures {
  private readonly client: LanguageClient;

  constructor(@inject(EXTENSION) context: ExtensionContext) {
    this.client = new LanguageClient(
      'grammarly',
      'Grammarly',
      getLanguageServerOptions(context.asAbsolutePath('out/server.js')),
      getLanguageClientOptions()
    );
  }

  private _isReady = false;

  register() {
    const disposable = this.client.start();

    this.client.onReady().then(() => {
      this._isReady = true;
      this.client.onRequest('$/credentials', async () => {
        const credentials =
          (await keytar.findCredentials('vscode-grammarly')) ||
          (await keytar.findCredentials('https://www.grammarly.com')) ||
          [];

        return credentials.length
          ? {
              username: credentials[0].account,
              password: credentials[0].password,
            }
          : undefined;
      });

      this.client.onRequest('$/getCookie', async () => {
        const content = await keytar.findPassword('vscode-grammarly-cookie');

        if (content) return JSON.parse(content);
      });

      this.client.onRequest('$/setCookie', (cookie: any) => {
        if (cookie) {
          keytar.setPassword(
            'vscode-grammarly-cookie',
            'default',
            JSON.stringify(cookie)
          );
        } else {
          keytar.deletePassword('vscode-grammarly-cookie', 'default');
        }
      });

      this.client.onRequest('$/error', (error, buttons) => {
        return window.showErrorMessage('Grammarly: ' + error, ...buttons);
      });
    });

    return disposable;
  }

  get onReady() {
    return this.client.onReady.bind(this.client);
  }

  isReady() {
    if (!this._isReady) {
      window.showInformationMessage(`Grammarly server is not ready yet.`);

      return false;
    }

    return true;
  }

  onEvent<Event extends keyof GrammarlyServerEvents>(
    event: Event,
    handler: GrammarlyServerEvents[Event]
  ) {
    return this.client.onNotification(`event:grammarly.${event}`, handler);
  }

  isIgnoredDocument(document: TextDocument) {
    const uri = document.uri.toString();
    const ignore =
      workspace
        .getConfiguration('grammarly', document.uri)
        .get<string[]>('ignore') || [];
    const isIgnored =
      !LANGUAGES.includes(document.languageId) ||
      ignore.some(pattern => minimatch(uri, pattern));
    return isIgnored;
  }

  async check(uri: string) {
    await this.client.sendRequest('$/check', [uri]);
  }

  async dismissAlert(uri: string, alertId: number) {
    await this.client.sendRequest('$/dismissAlert', [uri, alertId]);
  }

  async addToDictionary(uri: string, alertId: number) {
    await this.client.sendRequest('$/addToDictionary', [uri, alertId]);
  }

  async getSummary(uri: string): Promise<DocumentSummary> {
    return this.client.sendRequest('$/getSummary', [uri]);
  }

  async getStatistics(uri: string): Promise<DocumentStatistics> {
    return this.client.sendRequest('$/getStatistics', [uri]);
  }
}
