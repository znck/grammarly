import { Registerable } from '@/interfaces';
import { CONNECTION } from '@/server/constants';
import { Grammarly } from '@/server/grammarly';
import { GrammarlySettings, DEFAULT } from '@/settings';
import { inject, injectable } from 'inversify';
import minimatch from 'minimatch';
import {
  Connection,
  DiagnosticSeverity,
  Disposable,
} from 'vscode-languageserver';

@injectable()
export class ConfigurationService implements Registerable {
  private default: GrammarlySettings = DEFAULT;
  private user = this.default;

  private perDocumentSettings = new Map<string, Grammarly.DocumentContext>();
  private wip = new Map<string, Promise<Grammarly.DocumentContext>>();

  constructor(@inject(CONNECTION) private readonly connection: Connection) {}

  public get settings(): Readonly<GrammarlySettings> {
    return this.user;
  }

  register() {
    this.connection.onDidChangeConfiguration(({ settings }) => {
      if ('grammarly' in settings) {
        this.user = {
          ...this.default,
          ...settings.grammarly,
        };
      }
    });

    setTimeout(() => {
      this.connection.workspace.getConfiguration('grammarly').then(settings => {
        this.user = {
          ...this.default,
          ...settings,
        };
      });
    }, 0);

    return Disposable.create(() => {
      this.wip.clear();
      this.perDocumentSettings.clear();
    });
  }

  async getAlertSeverity(
    uri: string
  ): Promise<Record<string, DiagnosticSeverity>> {
    const config = await this.connection.workspace.getConfiguration({
      scopeUri: uri,
      section: 'grammarly',
    });

    return {
      ...this.default.severity,
      ...config?.severity,
    };
  }

  async getIgnoredTags(uri: string, languageId: string): Promise<string[]> {
    const config: GrammarlySettings = await this.connection.workspace.getConfiguration(
      {
        scopeUri: uri,
        section: 'grammarly',
      }
    );

    return config.diagnostics[`[${languageId}]`]?.ignore || [];
  }

  getDocumentSettings(uri: string) {
    if (this.perDocumentSettings.has(uri)) {
      return this.perDocumentSettings.get(uri)!;
    }

    if (this.wip.has(uri)) {
      return this.wip.get(uri)!;
    }

    const get = async () => {
      const config: GrammarlySettings = {
        ...this.user,
        ...(await this.connection.workspace.getConfiguration({
          scopeUri: uri,
          section: 'grammarly',
        })),
      };

      const override = config.overrides.find(override =>
        override.files.some(pattern => minimatch(uri, pattern))
      );

      const settings: Grammarly.DocumentContext = {
        audience: config.audience,
        dialect: config.dialect,
        domain: config.domain,
        emotion: config.emotion,
        emotions: config.emotions,
        goals: config.goals,
        style: config.style,
        ...override?.config,
      };

      this.perDocumentSettings.set(uri, settings);

      this.wip.delete(uri);

      return settings;
    };

    const promise = get();

    this.wip.set(uri, promise);

    return promise;
  }

  isIgnoredDocument(uri: string) {
    return this.user.ignore.some(pattern => minimatch(uri, pattern));
  }
}
