import { LanguageClient } from 'vscode-languageclient'
import { Connection } from 'vscode-languageserver'

interface APILike {}

export function createClient<T extends APILike>(connection: LanguageClient): T {
  return new Proxy<T>({} as any, {
    get(_, property) {
      if (typeof property === 'string') {
        return async (...args: any[]) => {
          await connection.onReady()

          return connection.sendRequest(`$/${property}`, args)
        }
      }

      throw new Error('Unknown method ')
    },
  })
}

interface LanguageServer {
  listen(connection: Connection): void
}

export function createHandler<T extends APILike>(handlers: T): LanguageServer {
  return {
    listen(connection) {
      Object.entries(handlers).forEach(([request, handler]) => {
        connection.onRequest(`$/${request}`, handler)
      })
    },
  }
}

/// --------------- ///

export type DictionaryType = 'grammarly' | 'workspace' | 'folder' | 'user'

export interface DocumentStatistics {
  performance: {
    score: number
  }
  content: {
    characters: number
    words: number
    sentences: number

    readingTime: string
    speakingTime: string
  }
  readability: {
    score: number
    message: string
    wordLength: number
    sentenceLength: number
  }
  vocubulary: {
    uniqueWords: number
    rareWords: number
  }
}

export interface DocumentSummary {
  overall: number
  scores: { Clarity: number; Correctness: number; Engagement: number; GeneralScore: number; Tone: number }
}

export interface GrammarlyServerAPI {
  check(resourse: string): Promise<void>
  dismissAlert(resource: string, alertId: number): Promise<void>
  addToDictionary(
    resource: string,
    options: { dictionary: DictionaryType; alertId: number; word: string }
  ): Promise<void>

  getSummary(resource: string): Promise<DocumentSummary>
  getStatistics(resource: string): Promise<DocumentStatistics>
  setCredentials(account: string, password: string): Promise<void>
}
