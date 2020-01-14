import { LanguageClient } from 'vscode-languageclient'
import { Connection } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-protocol'
import { Grammarly } from './grammarly'

interface ServerToClientEvent {
  [Grammarly.Action.FEEDBACK](uri: TextDocument['uri'], response: Grammarly.FeedbackResponse): void
  [Grammarly.Action.FINISHED](uri: TextDocument['uri'], response: Grammarly.FinishedResponse): void
}

interface ClientToServerEvent {}

interface LanguageServer extends Connection {}

export function sendCustomEventToClient<E extends keyof ServerToClientEvent>(
  connection: LanguageServer,
  event: E,
  params: Parameters<ServerToClientEvent[E]>
): void {
  connection.sendNotification('event:grammarly.' + event, params)
}

export function sendCustomEventToServer<E extends keyof ClientToServerEvent>(
  connection: LanguageClient,
  event: E,
  params: Parameters<ClientToServerEvent[E]>
): void {
  connection.sendNotification('event:grammarly.' + event, params)
}

export function onCustomEventFromServer<E extends keyof ServerToClientEvent>(
  connection: LanguageClient,
  event: E,
  fn: ServerToClientEvent[E]
) {
  connection.onNotification('event:grammarly.' + event, fn as any)
}

export function onCustomEventFromClient<E extends keyof ClientToServerEvent>(
  connection: LanguageServer,
  event: E,
  fn: ClientToServerEvent[E]
) {
  connection.onNotification('event:grammarly.' + event, fn as any)
}
