import { Registerable } from '@/interfaces';
import { CONNECTION, SERVER } from '@/server/constants';
import { GrammarlyDocument } from '@/server/grammarly/document';
import { AuthParams } from '@/server/socket';
import { inject, injectable } from 'inversify';
import {
  Connection,
  Disposable,
  ServerCapabilities,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver';
import { AuthCookie } from '../grammarly/auth';
import { ConfigurationService } from './configuration';
import { Grammarly } from '../grammarly';

@injectable()
export class DocumentService implements Registerable {
  private documents = new TextDocuments(GrammarlyDocument);
  private onDocumentOpenCbs: Array<(document: GrammarlyDocument) => any> = [];
  private onDocumentCloseCbs: Array<(document: GrammarlyDocument) => any> = [];
  private credentials?: AuthParams;
  private cookie?: AuthCookie;

  constructor(
    @inject(CONNECTION) private readonly connection: Connection,
    @inject(SERVER) private readonly capabilities: ServerCapabilities,
    private readonly configuration: ConfigurationService
  ) {}

  register() {
    this.capabilities.textDocumentSync = {
      openClose: true,
      change: TextDocumentSyncKind.Incremental,
    };

    this.documents.listen(this.connection);

    const disposables = [
      this.documents.onDidOpen(({ document }) => this.attachHost(document)),
      this.documents.onDidClose(({ document }) => this.handleClose(document)),
      Disposable.create(() =>
        this.documents.all().forEach((document) => document.detachHost())
      ),
    ];

    return Disposable.create(() =>
      disposables.forEach((disposable) => disposable.dispose())
    );
  }

  get(uri: string) {
    return this.documents.get(uri);
  }

  onDidOpen(fn: (document: GrammarlyDocument) => any) {
    this.onDocumentOpenCbs.push(fn);
  }

  onDidClose(fn: (document: GrammarlyDocument) => any) {
    this.onDocumentCloseCbs.push(fn);
  }

  async attachHost(document: GrammarlyDocument, force = false) {
    if (!this.configuration.settings.autoActivate && !force) return;

    const settings = await this.configuration.getDocumentSettings(document.uri);

    await this.loadCredentials();
    await this.loadSessions();

    document.attachHost(settings, this.credentials, this.cookie);

    if (!this.cookie) {
      document.host?.once('ready', () => {
        if (document.host?.isAuthenticated) {
          this.connection.sendRequest('$/setCookie', {
            username: document.host.authParams!.username,
            cookie: document.host.cookie!,
          });
        }
      });
    }
    if (document.host) {
      document.host.on(Grammarly.Action.ERROR, (error) => {
        this.connection.sendRequest('$/error', [error.message]);
      });
      document.host.on('abort', async (error: any) => {
        document.detachHost();
        if (/^(SHOW_CAPTCHA|RATE_LIMITED)$/.test(error.code || '')) {
          const result = await this.connection.sendRequest<any>('$/error', [
            error.message,
            [{ title: 'Retry' }, { title: 'Connect Anonymously' }],
          ]);

          const action = result?.title;
          if (action === 'Retry') {
            await this.connection.sendRequest('$/setCookie', null);
            setTimeout(() => {
              this.attachHost(document);
            }, 0);
          } else if (action === 'Connect Anonymously') {
            await this.connection.sendRequest('$/setCookie', null);
            const credentials = this.credentials;
            setTimeout(() => {
              this.credentials = {} as any;
              this.attachHost(document);
              this.credentials = credentials;
            }, 0);
          }
        } else {
          this.connection.sendRequest('$/error', [error.message]);
        }
      });
    }

    this.onDocumentOpenCbs.forEach((cb) => cb(document));
  }

  private async loadSessions() {
    if (!this.cookie) {
      const result = await this.connection.sendRequest<{
        username: string;
        cookie: AuthCookie;
      }>('$/getCookie');
      if (result) {
        if (result.username === this.credentials?.username) {
          this.cookie = result.cookie;
        } else {
          this.connection.sendRequest('$/setCookie', null);
        }
      }
    }
  }

  private async loadCredentials() {
    if (!this.credentials) {
      this.credentials = await this.connection.sendRequest<AuthParams>(
        '$/credentials'
      );
    }
  }

  private async handleClose(document: GrammarlyDocument) {
    this.onDocumentCloseCbs.forEach((cb) => cb(document));
    document.detachHost();
  }
}
