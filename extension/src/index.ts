import { ExtensionContext } from 'vscode'
import { GrammarlyClient } from './GrammarlyClient'

export async function activate(context: ExtensionContext) {
  const grammarly = new GrammarlyClient(context)

  await grammarly.client.onReady()
}

export function deactivate() {}
