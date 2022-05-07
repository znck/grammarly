import type { BaseLanguageClient } from 'vscode-languageclient'
import type { SessionStatus } from '@grammarly/sdk'

export interface Protocol {
  getDocumentStatus(uri: string): Promise<SessionStatus | null>
  handleOAuthCallbackUri(uri: string): void
  onDocumentStatus(fn: (params: { uri: string; status: SessionStatus }) => unknown): void
  onOpenOAuthUrl(fn: (url: string) => unknown): void
}

export function createProtocol(client: BaseLanguageClient): Protocol {
  return new Proxy({} as Protocol, {
    get(_, property) {
      if (typeof property !== 'string') return
      if (property.startsWith('on')) {
        return (fn: (...args: unknown[]) => unknown) => client.onNotification(`$/${property}`, fn)
      } else {
        return async (...args: unknown[]): Promise<unknown> => {
          console.log('Request:', property, ...args)
          try {
            const result = await client.sendRequest(`$/${property}`, args)
            console.log('Response:', property, result)
            return result
          } catch (error) {
            console.log('Error:', property, error)
            throw error
          }
        }
      }
    },
  })
}
