import minimatch from 'minimatch'
import { inject, injectable } from 'inversify'
import { DocumentContext } from 'unofficial-grammarly-api-2'
import { Connection, DiagnosticSeverity, Disposable } from 'vscode-languageserver'
import { CONNECTION } from '../constants'
import { Registerable } from '../interfaces'
import { DEFAULT, GrammarlySettings } from '../settings'
import { toArray } from './toArray'

@injectable()
export class ConfigurationService implements Registerable {
  private default: GrammarlySettings = DEFAULT
  private user = this.default

  private perDocumentSettings = new Map<string, DocumentContext>()
  private wip = new Map<string, Promise<DocumentContext>>()

  constructor (@inject(CONNECTION) private readonly connection: Connection) { }

  public get settings(): Readonly<GrammarlySettings> {
    return this.user
  }

  register() {
    this.connection.onDidChangeConfiguration(({ settings }) => {
      if ('grammarly' in settings) {
        this.user = {
          ...this.default,
          ...settings.grammarly,
        }
        this.perDocumentSettings.clear()
        this.wip.clear()
      }
    })

    setTimeout(() => {
      this.connection.workspace.getConfiguration('grammarly').then((settings) => {
        this.user = {
          ...this.default,
          ...settings,
        }
      })
    }, 0)

    return Disposable.create(() => {
      this.wip.clear()
      this.perDocumentSettings.clear()
    })
  }

  async getAlertSeverity(uri: string): Promise<Record<string, DiagnosticSeverity>> {
    const config = await this.connection.workspace.getConfiguration({
      scopeUri: uri,
      section: 'grammarly',
    })

    return {
      ...this.default.severity,
      ...config?.severity,
    }
  }

  async getIgnoredTags(uri: string, languageId: string): Promise<string[]> {
    const config: GrammarlySettings = await this.connection.workspace.getConfiguration({
      scopeUri: uri,
      section: 'grammarly',
    })

    return config.diagnostics[`[${languageId}]`]?.ignore || []
  }

  getDocumentSettings(uri: string, fresh = false) {
    if (this.perDocumentSettings.has(uri) && fresh === false) {
      return this.perDocumentSettings.get(uri)!
    }

    if (this.wip.has(uri)) {
      return this.wip.get(uri)!
    }

    const get = async () => {
      const config: GrammarlySettings = {
        ...this.user,
        ...(await this.connection.workspace.getConfiguration({
          scopeUri: uri,
          section: 'grammarly',
        })),
      }

      const override = config.overrides.find((override) =>
        toArray(override.files).some((pattern) => minimatch(uri, pattern)),
      )

      const settings: DocumentContext = {
        audience: config.audience,
        dialect: config.dialect,
        domain: config.domain,
        emotions: config.emotions,
        goals: config.goals,
        style: config.style,
        ...override?.config,
      }

      this.perDocumentSettings.set(uri, settings)

      this.wip.delete(uri)

      return settings
    }

    const promise = get()

    this.wip.set(uri, promise)

    return promise
  }

  isIgnoredDocument(uri: string) {
    return toArray(this.user.ignore).some((pattern) => minimatch(uri, pattern))
  }
}
