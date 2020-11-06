import { injectable } from 'inversify'

import { commands, window } from 'vscode'
import { getKeyTar } from '../keytar'
import { Registerable } from '../interfaces'

@injectable()
export class ClearCredentialsCommand implements Registerable {
  register() {
    return commands.registerCommand('grammarly.clearCredentials', this.execute.bind(this))
  }

  private async execute() {
    for (const credentials of await getKeyTar().findCredentials('vscode-grammarly')) {
      getKeyTar().deletePassword('vscode-grammarly', credentials.account)
    }
    for (const credentials of await getKeyTar().findCredentials('vscode-grammarly-cookie')) {
      getKeyTar().deletePassword('vscode-grammarly-cookie', credentials.account)
    }
    window.showInformationMessage(`Logged out of grammarly.com.`)
  }
}
