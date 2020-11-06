import { Container } from 'inversify'
import 'reflect-metadata'
import { Disposable, ExtensionContext } from 'vscode'
import { GrammarlyClient } from './client'
import { AddWordCommand } from './commands/AddWordCommand'
import { CheckCommand } from './commands/CheckGrammarCommand'
import { ClearCredentialsCommand } from './commands/ClearCredentialsCommand'
import { IgnoreIssueCommand } from './commands/IgnoreIssueCommand'
import { ServerCallbackCommand } from './commands/ServerCallbackCommand'
import { AuthenticationService } from './commands/SetCredentialsCommand'
import { SetGoalsCommand } from './commands/SetGoalsCommand'
import { StatsCommand } from './commands/StatsCommand'
import { EXTENSION } from './constants'
import { StatusBarController } from './controllers/StatusBarController'

export async function activate(context: ExtensionContext) {
  const container = new Container({
    autoBindInjectable: true,
    defaultScope: 'Singleton',
  })

  container.bind(EXTENSION).toConstantValue(context)
  container.bind(GrammarlyClient).toConstantValue(new GrammarlyClient(context))
  context.subscriptions.push(
    container.get(GrammarlyClient).register(),
    container.get(StatusBarController).register(),
    container.get(AddWordCommand).register(),
    container.get(CheckCommand).register(),
    container.get(IgnoreIssueCommand).register(),
    container.get(StatsCommand).register(),
    container.get(AuthenticationService).register(),
    container.get(ClearCredentialsCommand).register(),
    container.get(ServerCallbackCommand).register(),
    container.get(SetGoalsCommand).register(),
    new Disposable(() => container.unbindAll()),
  )

  return container.get(GrammarlyClient).onReady()
}

export function deactivate() {}
