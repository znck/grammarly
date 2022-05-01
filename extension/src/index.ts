import 'reflect-metadata'
import { Container } from 'inversify'
import { Disposable, ExtensionContext } from 'vscode'
import { GrammarlyClient } from './GrammarlyClient'
import { EXTENSION } from './constants'

export async function activate(context: ExtensionContext) {
  const container = new Container({
    autoBindInjectable: true,
    defaultScope: 'Singleton',
  })

  container.bind(EXTENSION).toConstantValue(context)
  container.bind(GrammarlyClient).toConstantValue(new GrammarlyClient(context))

  context.subscriptions.push(
    container.get(GrammarlyClient).register(),

    new Disposable(() => container.unbindAll()),
  )

  await container.get(GrammarlyClient).client.onReady()
}

export function deactivate() {}
