import { GrammarlyLanguageClient } from 'unofficial-grammarly-language-client'
import { Disposable, ExtensionContext, Uri, workspace } from 'vscode'
import { AuthenticationService } from '../services/AuthenticationService'
import { Registerable } from '../interfaces'

export class GrammarlyClient extends GrammarlyLanguageClient implements Registerable {
  private challenges = new Map<string, { secret: string; callback: (error: null | Error, code: string) => any }>()

  constructor(context: ExtensionContext, private readonly auth: AuthenticationService) {
    super(context.asAbsolutePath('dist/server/index.js'), {
      getCredentials: async () => {
        if (process.env.EXTENSION_TEST_MODE) return null

        return await this.auth.login()
      },
      loadToken: async () => {
        if (process.env.EXTENSION_TEST_MODE) return null

        return await this.auth.getCookie()
      },
      saveToken: async (cookie) => {
        await this.auth.setCookie(cookie)
      },
      getIgnoredDocuments: (uri) =>
        workspace.getConfiguration('grammarly', Uri.parse(uri)).get<string[]>('ignore') ?? [],
    })
  }

  register() {
    return Disposable.from(this.grammarly.start())
  }
}
