import { LanguageClient } from 'vscode-languageclient';
import { getLanguageServerOptions, getLanguageClientOptions } from './options';
import { ExtensionContext } from 'vscode';
import { GrammarlyServerAPI, createClient } from '@/protocol';

let client: LanguageClient;
let grammarlyAPI: GrammarlyServerAPI;

export async function stopClient() {
  if (client) {
    await client.stop();
  }
}

export function startClient(context: ExtensionContext) {
  client = new LanguageClient(
    'grammarly',
    'Grammarly',
    getLanguageServerOptions(context.asAbsolutePath('out/server.js')),
    getLanguageClientOptions()
  );

  context.subscriptions.push(client.start());

  grammarlyAPI = createClient(client);
}

export function getClient(): LanguageClient {
  return client;
}

export function getGrammarlyClient() {
  return grammarlyAPI;
}
