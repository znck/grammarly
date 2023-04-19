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
import { IDBStorage, VirtualStorage } from './VirtualStorage'
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
const localStorage = new IDBStorage()
if (!('localStorage' in globalThis)) (globalThis as any).localStorage = localStorage
const sessionStorage = new VirtualStorage()
if (!('sessionStorage' in globalThis)) (globalThis as any).sessionStorage = sessionStorage

export const startLanguageServer = createLanguageServer({
  getConnection,
  createTextDocuments,
  init(clientId) {
    // @ts-ignore
    return new globalThis.Grammarly.SDK(clientId)
  },
  async pathEnvironmentForSDK() {
    if ((globalThis as any).localStorage === localStorage) {
      await localStorage.load()
    }
  },
})
