import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentsConfiguration,
} from 'vscode-languageserver/browser'
import { createLanguageServer } from './createLanguageServer'
import { DOMParser } from './DOMParser'
import { VirtualStorage } from './VirtualStorage'
function getConnection() {
  const messageReader = new BrowserMessageReader(self as unknown as Worker)
  const messageWriter = new BrowserMessageWriter(self as unknown as Worker)
  return createConnection(ProposedFeatures.all, messageReader, messageWriter)
}

function createTextDocuments<T>(config: TextDocumentsConfiguration<T>): TextDocuments<T> {
  return new TextDocuments(config)
}

// Polyfill DOMParser as it is not available in worker.
if (!('DOMParser' in globalThis)) (globalThis as any).DOMParser = DOMParser
if (!('localStorage' in globalThis)) (globalThis as any).localStorage = new VirtualStorage()
if (!('sessionStorage' in globalThis)) (globalThis as any).sessionStorage = new VirtualStorage()

export const startLanguageServer = createLanguageServer({
  getConnection,
  createTextDocuments,
  init(clientId) {
    // @ts-ignore
    return new globalThis.Grammarly.SDK(clientId)
  },
  pathEnvironmentForSDK() {},
})
