import type { BaseLanguageClient } from 'vscode-languageclient'
import type { SessionStatus, SuggestionId } from '@grammarly/sdk'

export interface Protocol {
  pause(): Promise<void>
  getDocumentStatus(uri: string): Promise<SessionStatus | null>
  isUserAccountConnected(): Promise<boolean>
  getOAuthUrl(oauthRedirectUri: string): Promise<string>
  logout(): Promise<void>
  dismissSuggestion(params: { uri: string; suggestionId: SuggestionId }): Promise<void>
  handleOAuthCallbackUri(uri: string): void
  onDocumentStatus(fn: (params: { uri: string; status: SessionStatus }) => unknown): void
  onUserAccountConnectedChange(fn: (params: { isUserAccountConnected: boolean }) => unknown): void
}

export function createProtocol(client: BaseLanguageClient): Protocol {
  return new Proxy({} as Protocol, {
    get(_, property) {
      if (typeof property !== 'string') return
      if (property.startsWith('on')) {
        return (fn: (...args: unknown[]) => unknown) => client.onNotification(`$/${property}`, fn)
      } else {
        return async (...args: unknown[]): Promise<unknown> => {
          try {
            const result = await client.sendRequest(`$/${property}`, args)
            return result
          } catch (error) {
            throw error
          }
        }
      }
    },
  })
}
