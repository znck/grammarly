import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentsConfiguration,
} from 'vscode-languageserver/browser'
import { createLanguageServer } from './createLanguageServer'

function getConnection() {
  const messageReader = new BrowserMessageReader(self as unknown as Worker)
  const messageWriter = new BrowserMessageWriter(self as unknown as Worker)
  return createConnection(ProposedFeatures.all, messageReader, messageWriter)
}

function createTextDocuments<T>(config: TextDocumentsConfiguration<T>): TextDocuments<T> {
  return new TextDocuments(config)
}

export const startLanguageServer = createLanguageServer({ getConnection, createTextDocuments })
