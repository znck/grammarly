import { GrammarlyLanguageClient } from 'unofficial-grammarly-language-client'
import { Disposable, ExtensionContext, Uri, workspace } from 'vscode'
import { AuthenticationService } from '../services/AuthenticationService'
import { Registerable } from '../interfaces'

export class GrammarlyClient extends GrammarlyLanguageClient implements Registerable {
  constructor (context: ExtensionContext, private readonly auth: AuthenticationService) {

    super(context.asAbsolutePath('dist/server/index.js'), {
      info: {
        name: 'Grammarly'
      },
      getCredentials: async () => {
        if (process.env.EXTENSION_TEST_MODE) return null

        return null
      },
      loadToken: async () => {
        console.log('Get token...')
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
    return Disposable.from(this.start())
  }
}
