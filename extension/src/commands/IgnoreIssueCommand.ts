import { injectable } from 'inversify'
import { commands } from 'vscode'
import { GrammarlyClient } from '../client'
import { Registerable } from '../interfaces'

@injectable()
export class IgnoreIssueCommand implements Registerable {
  constructor(private readonly client: GrammarlyClient) {}

  register() {
    return commands.registerCommand('grammarly.ignoreIssue', this.execute.bind(this))
  }

  private async execute(uri: string, alertId: number) {
    if (!this.client.isReady()) return

    await this.client.dismissAlert(uri, alertId)
  }
}
