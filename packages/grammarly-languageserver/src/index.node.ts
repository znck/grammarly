import './polyfill-fetch'

import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentsConfiguration,
} from 'vscode-languageserver/node'
import { createLanguageServer } from './createLanguageServer'
import { init } from '@grammarly/sdk'
import { FileStorage } from './FileStorage'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

function getConnection() {
  return createConnection(ProposedFeatures.all)
}

function createTextDocuments<T>(config: TextDocumentsConfiguration<T>): TextDocuments<T> {
  return new TextDocuments(config)
}

function pathEnvironmentForSDK(clientId: string): void {
  ;(globalThis as any).localStorage = new FileStorage(
    resolve(homedir(), '.config', 'grammarly-languageserver', clientId),
  )
}

export const startLanguageServer = createLanguageServer({
  getConnection,
  createTextDocuments,
  init,
  pathEnvironmentForSDK,
})
