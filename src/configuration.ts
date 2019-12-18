import * as vscode from 'vscode'
import { Grammarly } from './grammarly'

export interface ExtensionConfiguration {
  username?: string
  password?: string
  dialect: Grammarly.Dialect
}

const DEFAULT: ExtensionConfiguration = {
  dialect: Grammarly.Dialect.AMERICAN,
}

export function getConfigurationFor(uri: string): ExtensionConfiguration {
  return {
    ...DEFAULT,
    ...vscode.workspace.getConfiguration(undefined, uri ? vscode.Uri.parse(uri) : null).get('grammarly'),
  }
}
