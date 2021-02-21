// TODO: Remove dependency on "ws" for browser usage.

import WebSocket from 'ws'
import { name, version } from '../package.json'
import { DevLogger } from './DevLogger'
import { SocketError } from './SocketError'
import { StartRequest } from './transport/messages/StartRequest'
import { isRequestType, Request } from './transport/Request'
import { RequestKind } from './transport/RequestKind'
import { isAckResponse, isResponseType, Response, ResponseOf } from './transport/Response'
import { ResponseKind } from './transport/ResponseKind'

const UA = `${name} v${version} (NodeJS ${process.version})`

export class SocketClient {
  private LOGGER = __DEV__ ? new DevLogger(SocketClient.name, this.id.substr(0, 6)) : null
  private _socket: WebSocket | null = null
  private _canReconnect = true

  private _statusCode: SocketErrorCodeType | null = null
  private _statusMessage: string | null = null

  private _pendingResponses = 0
  private _nextId: number = 0
  private _queue: Request[] = []
  private _callbacks = new Map<number, (response: Response) => void>()

  public readonly status: SocketConnectionStatus = 'closed'

  private _setStatus(value: SocketConnectionStatus) {
    if (__DEV__) this.LOGGER?.trace(`WebSocket: Connection status changed: ${this.status} -> ${value}`)

    // @ts-expect-error 2540 - Internally writable
    this.status = value
  }

  private UA: string

  constructor (
    public readonly id: string,
    private readonly _getToken: () => Promise<string> | string,
    private readonly _onConnection: () => void = () => { },
    private readonly _onMessage: (message: Response) => void = () => { },
    ua: string = '',
    private readonly additionalHeaders: Record<string, string> = {}
  ) {
    this.UA = `${ua} ${UA}`

    this._connect()
  }

  public dispose() {
    this._socket?.close(SocketErrorCode.GOING_AWAY)
  }

  protected async send<T extends Request>(message: T, priority: boolean = false): Promise<ResponseOf<T>> {
    const request: Request = { ...message, id: this._nextId }

    this._nextId += 1
    return new Promise((resolve) => {
      this._callbacks.set(request.id, (response) => resolve(response as ResponseOf<T>))

      this._queueOrSend(request, priority)
    })
  }

  protected async forceReConnect(): Promise<void> {
    if (__DEV__) this.LOGGER?.trace('[FORCE] Reconnect to CAPI')

    this._canReconnect = true
    await this._connect()
  }

  private async _connect(): Promise<void> {
    if (__DEV__) this.LOGGER?.trace('Connect: Initiate CAPI connection')
    if (this.status === 'connecting') {
      if (__DEV__) this.LOGGER?.trace('Connect: Another request in progress')
      return
    }

    if (this._socket) {
      if (__DEV__) this.LOGGER?.trace('Connect: Already connected')
      return
    }

    if (!this._canReconnect) {
      if (__DEV__)
        this.LOGGER?.trace(`Connect: Aborting due to pre-existing error - ${this._statusCode}: ${this._statusMessage}`)
      throw new SocketError(this._statusCode!, `Socket connection failed: ${this._statusMessage}`)
    }

    const cookies = await this._getToken()
    this._pendingResponses = 0
    this._nextId = 0
    this._queue = []
    this._setStatus('connecting')
    this._statusCode = null
    this._statusMessage = null

    const headers = { ...this.additionalHeaders,
                      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36',
                      Accept: 'application/json', Cookie: cookies }
    this._socket = new WebSocket('wss://capi.grammarly.com/freews', {
      headers: headers,
    })

    if (__DEV__)
      this.LOGGER?.trace('Send Headers: ', headers)

    this._socket.onopen = () => {
      if (__DEV__) this.LOGGER?.trace('WebSocket: Connection established.')
      this._setStatus('connected')
      this._queue.length = 0
      this._onConnection()
      this._flushQueue()
    }

    this._socket.onclose = (event) => {
      if (__DEV__) this.LOGGER?.trace(`WebSocket: Connection closed - ${event.code}: ${event.reason}`)
      this._socket = null

      switch (event.code) {
        case SocketErrorCode.BAD_REQUEST:
        case SocketErrorCode.GOING_AWAY:
        case SocketErrorCode.UNAUTHORIZED:
          this._canReconnect = false
          break
        case SocketErrorCode.CLOSED_ABNORMALLY:
        case SocketErrorCode.SERVER_ERROR:
        case SocketErrorCode.SERVER_SHUTDOWN:
          this._canReconnect = true
          break
        default:
          this._canReconnect = true
          break
      }

      this._statusCode = event.code
      this._statusMessage = event.reason

      if (this.status !== 'errored') {
        this._setStatus('closed')
      }
    }

    this._socket.onmessage = (event) => {
      if (__DEV__) this.LOGGER?.trace(`WebSocket: Message - ${event.type}`)

      try {
        const response = JSON.parse(event.data.toString())

        this._handleMessage(response)
      } catch (error) {
        if (__DEV__) this.LOGGER?.error('WebSocket: Failed to parse response -', error)
      }
    }

    this._socket.onerror = (event) => {
      if (__DEV__) this.LOGGER?.error(`WebSocket: Error - ${event.type}: ${event.message}`, event.error)
      this._setStatus('errored')
    }
  }

  private _queueOrSend(message: Request, priority: boolean) {
    if (__DEV__) this.LOGGER?.trace(`WebSocket: Send(${message.id}): ${message.action}`)
    if (!this._socket) {
      this._connect()
      this._queueMessage(message)
    } else if (isRequestType(message, RequestKind.START)) {
      this._sendStartMessage(message)
    } else if (this.status === 'ready') {
      this._sendAnyMessage(message, priority)
    } else {
      this._queueMessage(message)
    }
  }

  /**
   * Ensure socket is in ready state.
   */
  private _sendAnyMessage(message: Request, priority: boolean): void {
    if (this._pendingResponses <= 0 || priority) {
      this._sendToSocket(message)
    } else {
      this._queueMessage(message)
    }
  }

  private _sendStartMessage(message: StartRequest): void {
    if (this.status === 'connected') {
      this._sendToSocket(message)
    } else {
      this._queueMessage(message, true)
    }
  }

  private _queueMessage(message: Request, atStart = false): void {
    if (__DEV__) this.LOGGER?.trace(`CAPI: Queue(${message.id}) — ${message.action}`)
    if (atStart) this._queue.unshift(message)
    else this._queue.push(message)
  }

  private _sendToSocket(message: Request): void {
    if (!this._socket) throw new Error(`InternalError: sending before connection is established.`)
    if (__DEV__) this.LOGGER?.trace(`CAPI: Send(${message.id}) — ${message.action}`, message)
    this._socket.send(JSON.stringify(message))
    this._pendingResponses += 1
  }

  private _flushQueue(): void {
    if (__DEV__) this.LOGGER?.trace(`WebSocket: Flushing queue`)
    const message = this._queue.shift()
    if (message) this._sendToSocket(message)
  }

  private _handleMessage(response: Response) {
    if (isResponseType(response, ResponseKind.START)) {
      if (this.status === 'connected') {
        this._setStatus('ready')
      }
    }

    if (isAckResponse(response)) {
      if (__DEV__) this.LOGGER?.trace(`CAPI: Ack(${response.id}) — ${response.action}`, response)
      this._pendingResponses -= 1
      const callback = this._callbacks.get(response.id)!
      try {
        callback(response)
      } catch { }

      this._callbacks.delete(response.id)
    } else {
      if (__DEV__) this.LOGGER?.trace(`CAPI: Recv() — ${response.action}`, response)
    }

    try {
      this._onMessage(response)
    } catch { }

    if (isAckResponse(response)) this._flushQueue()
  }
}

export const SocketErrorCode = {
  GOING_AWAY: 1001,
  CLOSED_ABNORMALLY: 1006,
  SERVER_ERROR: 1011,
  BAD_REQUEST: 4000,
  UNAUTHORIZED: 4001,
  SERVER_SHUTDOWN: 4002,
}
export type SocketErrorCodeType = typeof SocketErrorCode[keyof typeof SocketErrorCode]

export type SocketConnectionStatus = 'connecting' | 'connected' | 'ready' | 'errored' | 'closed'
