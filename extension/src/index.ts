import { Disposable, ExtensionContext } from 'vscode'
import { GrammarlyClient } from './GrammarlyClient'
import { StatusBarController } from './StatusBarController'

export async function activate(context: ExtensionContext) {
  const grammarly = new GrammarlyClient(context)
  await grammarly.start()
  return Disposable.from(grammarly.register(), new StatusBarController(grammarly).register())
}
