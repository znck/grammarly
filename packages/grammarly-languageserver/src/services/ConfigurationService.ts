import { inject, injectable } from 'inversify'
import { Connection, Disposable } from 'vscode-languageserver/node'
import { CONNECTION } from '../constants'
import { Registerable } from '../interfaces/Registerable'
import { EditorConfig } from '@grammarly/sdk'

type DocumentConfig = Pick<EditorConfig, 'documentDialect' | 'documentDomain' | 'suggestions'>

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
    return await this.#connection.workspace.getConfiguration('grammarly')
  }

  public async getDocumentSettings(uri: string): Promise<DocumentConfig> {
    return {
      ...(await this.getSettings()),
      ...(await this.#connection.workspace.getConfiguration({ scopeUri: uri, section: 'grammarly' })),
    }
  }
}
