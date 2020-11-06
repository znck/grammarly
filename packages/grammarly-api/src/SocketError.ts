export class SocketError extends Error {
  constructor(public readonly code: number, message: string) {
    super(message)
  }
}
