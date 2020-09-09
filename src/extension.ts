import 'reflect-metadata';
import { Container } from 'inversify';
import { ExtensionContext, Disposable } from 'vscode';
import { GrammarlyClient } from './client';
import { AddWordCommand } from './commands/AddWordCommand';
import { CheckCommand } from './commands/CheckGrammarCommand';
import { IgnoreIssueCommand } from './commands/IgnoreIssueCommand';
import { StatsCommand } from './commands/StatsCommand';
import { EXTENSION } from './constants';
import { StatusBarController } from './controllers/StatusBarController';
import { AuthenticationService } from './commands/SetCredentialsCommand';
import { ServerCallbackCommand } from './commands/ServerCallbackCommand';
import { SetGoalsCommand } from './commands/SetGoalsCommand';
import { ClearCredentialsCommand } from './commands/ClearCredentialsCommand';
import vscode from 'vscode';

process.env.DEBUG = 'grammarly:*';

export async function activate(context: ExtensionContext) {
  const container = new Container({
    autoBindInjectable: true,
    defaultScope: 'Singleton',
  });

  container.bind(EXTENSION).toConstantValue(context);
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
    new Disposable(() => container.unbindAll())
  );

  return container.get(GrammarlyClient).onReady();
}

export function deactivate() {}
