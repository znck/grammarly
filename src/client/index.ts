import { LanguageClient } from 'vscode-languageclient'
import { getLanguageServerOptions, getLanguageClientOptions } from './options'
import { ExtensionContext } from 'vscode'

let client: LanguageClient

export async function stopClient() {
  if (client) {
    await client.stop()
  }
}

export function startClient(context: ExtensionContext) {
  client = new LanguageClient(
    'grammarly',
    'Grammarly',
    getLanguageServerOptions(context.asAbsolutePath('out/server.js')),
    getLanguageClientOptions()
  )

  context.subscriptions.push(client.start())
}

export function getClient(): LanguageClient {
  return client
}
