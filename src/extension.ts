import 'reflect-metadata';
import { Container } from 'inversify';
import { ExtensionContext } from 'vscode';
import { GrammarlyClient } from './client';
import { AddWordCommand } from './commands/add-word';
import { CheckCommand } from './commands/check';
import { IgnoreIssueCommand } from './commands/ignore-issue';
import { StatsCommand } from './commands/stats';
import { EXTENSION } from './constants';
import { StatusBarController } from './controllers/status-bar';
import { SetCredentialsCommand } from './commands/set-credentials';
import { PostQuickFixCommand } from './commands/post-quick-fix';

process.env.DEBUG = 'grammarly:*';

const container = new Container({
  autoBindInjectable: true,
  defaultScope: 'Singleton',
});

export async function activate(context: ExtensionContext) {
  container.bind(EXTENSION).toConstantValue(context);

  await context.subscriptions.push(
    container.get(GrammarlyClient).register(),
    container.get(StatusBarController).register(),
    container.get(AddWordCommand).register(),
    container.get(CheckCommand).register(),
    container.get(IgnoreIssueCommand).register(),
    container.get(StatsCommand).register(),
    container.get(SetCredentialsCommand).register(),
    container.get(PostQuickFixCommand).register()
  );
}

export async function deactivate() {
  container.unbindAll();
}
