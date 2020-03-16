import { ExtensionContext } from 'vscode'
import { startClient, stopClient, getClient } from './client'
import { registerAddWordCommand } from './client/commands/add-word'
import { registerCheckCommand } from './client/commands/check'
import { registerIgnoreWordCommand } from './client/commands/ignore-issue'
import { registerStatsCommand } from './client/commands/stats'
import { registerStatusBar } from './client/status-bar'
import { registerSetCredentials } from './client/commands/set-credentials'

process.env.DEBUG = 'grammarly:*'

export async function activate(context: ExtensionContext) {
  console.log('Welcome to "Grammarly" extension.')
  startClient(context)

  registerSubscriptions(context)
  registerStatusBar(context)
}

export async function deactivate() {
  await stopClient()
}

function registerSubscriptions(context: ExtensionContext) {
  const client = getClient()

  client.onReady().then(() => {
    context.subscriptions.push(
      // commands
      registerCheckCommand(),
      registerIgnoreWordCommand(),
      registerAddWordCommand(),
      registerStatsCommand(),
    )
    return registerSetCredentials(context)
  })
}
