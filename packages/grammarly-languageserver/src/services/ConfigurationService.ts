import { inject, injectable } from 'inversify'
import type { Connection, Disposable } from 'vscode-languageserver'
import { CONNECTION } from '../constants'
import { Registerable } from '../interfaces/Registerable'
import { EditorConfig } from '@grammarly/sdk'

type DocumentConfig = Pick<EditorConfig, 'documentDialect' | 'documentDomain' | 'suggestionCategories'>

@injectable()
export class ConfigurationService implements Registerable {
  readonly #connection: Connection

  public constructor(@inject(CONNECTION) connection: Connection) {
    this.#connection = connection
  }

  public register(): Disposable {
    return { dispose() {} }
  }

  public async getSettings(): Promise<DocumentConfig> {
    const result: { config?: DocumentConfig } | undefined = await this.#connection.workspace.getConfiguration(
      'grammarly',
    )

    return result?.config ?? {}
  }

  public async getDocumentSettings(uri: string): Promise<DocumentConfig> {
    const result: { config?: DocumentConfig } | undefined = await Promise.race([
      this.#connection.workspace.getConfiguration({ scopeUri: uri, section: 'grammarly' }),
      new Promise((resolve) => setTimeout(resolve, 1000, {})),
    ])

    const options: DocumentConfig = {
      documentDialect: 'american',
      ...result?.config,
    }

    if ((options as any).suggestions != null) {
      options.suggestionCategories = { ...options.suggestionCategories }

      for (const [key, value] of Object.entries((options as any).suggestions)) {
        if (value == null) continue // ignore default values.

        const property = (key.slice(0, 1).toLocaleLowerCase() +
          key.slice(1)) as unknown as keyof Required<DocumentConfig>['suggestionCategories']
        options.suggestionCategories[property] ??= value ? 'on' : 'off'
      }

      delete (options as any).suggestions
    }

    return options
  }
}
