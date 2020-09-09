import { GrammarlyClient } from '@/client';
import { Registerable } from '@/interfaces';
import { injectable } from 'inversify';
import { commands } from 'vscode';
import { Logger } from '@/utils/Logger';

@injectable()
export class ServerCallbackCommand implements Registerable {
  private LOGGER = new Logger(ServerCallbackCommand.name);

  constructor(private readonly client: GrammarlyClient) {}

  register() {
    this.LOGGER.trace('Registering grammarly.callback command');

    return commands.registerCommand('grammarly.callback', this.execute.bind(this));
  }

  private async execute(options: { method: string; params: any }) {
    this.LOGGER.trace('Executed with', options);
    if (!this.client.isReady()) {
      await this.client.onReady();
    }

    this.client.sendFeedback(options.method, options.params);
  }
}
