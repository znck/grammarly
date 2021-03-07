import {
  anonymous,
  authenticate,
  DocumentContext,
  GrammarlyAuthContext,
  SocketError,
  SocketErrorCode,
} from 'unofficial-grammarly-api-2'
import { DevLogger } from './DevLogger'
import { GrammarlyDocument } from './GrammarlyDocument'
import { TextGrammarCheckHost } from './hosts/TextGrammarCheckHost'
import { version } from '../package.json'

const knownClients: Record<string, { name: string, type: string, version: string }> = {
  'vscode': {
    name: 'extension_vscode',
    type: 'general',
    version: version
  },
  'vscode-insiders': {
    name: 'extension_vscode',
    type: 'insiders',
    version: version
  },
}

export class GrammarlyHostFactory {
  private LOGGER = new DevLogger(GrammarlyHostFactory.name)
  private auth: GrammarlyAuthContext | null = null

  constructor(
    private getDocumentContext: (document: GrammarlyDocument) => Promise<DocumentContext>,
    private getCredentials: () => Promise<{ username: string; password: string } | string>,
    private storeToken: (token: string | null) => void,
  ) { }

  public create(document: GrammarlyDocument, clientInfo: { name: string; version?: string }) {
    const host = new TextGrammarCheckHost(
      knownClients[clientInfo.name] ?? clientInfo,
      document,
      () => this.getDocumentContext(document),
      () => this.getAuth(),
      (error) => {
        if (error instanceof SocketError) {
          if (error.code === SocketErrorCode.UNAUTHORIZED) {
            this.auth = null
            // @ts-ignore - accessing private property.
            host.api.reconnect()
          }
        }
      },
    )

    return host
  }

  private async getAuth(): Promise<GrammarlyAuthContext> {
    if (!this.auth) {
      try {
        this.auth = await this.asUser()
      } catch (error) {
        console.error(error)
      }
    }

    return this.auth || this.asAnonymous()
  }

  private async asAnonymous() {
    return (this.auth = await anonymous())
  }

  private async asUser() {
    const credentials = await this.getCredentials()

    if (typeof credentials === 'string') {
      return JSON.parse(credentials)
    } else if (credentials) {
      this.auth = await authenticate(credentials.username, credentials.password)
      if (this.auth) this.storeToken(JSON.stringify(this.auth))
    }
  }
}
