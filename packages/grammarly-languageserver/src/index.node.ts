import './polyfill-fetch'

import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentsConfiguration,
} from 'vscode-languageserver/node'
import { createLanguageServer } from './createLanguageServer'

function getConnection() {
  return createConnection(ProposedFeatures.all)
}

function createTextDocuments<T>(config: TextDocumentsConfiguration<T>): TextDocuments<T> {
  return new TextDocuments(config)
}

export const startLanguageServer = createLanguageServer({ getConnection, createTextDocuments })
