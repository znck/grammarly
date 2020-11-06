import { GrammarlyLanguageClient } from 'unofficial-grammarly-language-client'
import { ExtensionContext, Uri, workspace } from 'vscode'
import { Registerable } from '../interfaces'
import { getKeyTar } from '../keytar'

export class GrammarlyClient extends GrammarlyLanguageClient implements Registerable {
  constructor(context: ExtensionContext) {
    super(context.asAbsolutePath('dist/server/index.js'), {
      getCredentials: async () => {
        if (process.env.EXTENSION_TEST_MODE) return null

        const credentials = (await getKeyTar().findCredentials('vscode-grammarly')) || []

        return credentials.length
          ? {
              username: credentials[0].account,
              password: credentials[0].password,
            }
          : null
      },
      loadToken: async () => {
        if (process.env.EXTENSION_TEST_MODE) {
          return await getKeyTar().findPassword('vscode-grammarly-cookie')
        } else {
          return null
        }
      },
      saveToken: async (cookie) => {
        if (cookie != null) {
          getKeyTar().setPassword('vscode-grammarly-cookie', 'default', cookie)
        } else {
          getKeyTar().deletePassword('vscode-grammarly-cookie', 'default')
        }
      },
      getIgnoredDocuments: (uri) =>
        workspace.getConfiguration('grammarly', Uri.parse(uri)).get<string[]>('ignore') ?? [],
    })
  }

  register() {
    return this.grammarly.start()
  }
}
