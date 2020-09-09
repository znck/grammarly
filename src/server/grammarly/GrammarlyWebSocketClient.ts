import { Logger } from '@/utils/Logger';
import WebSocket from 'ws';
import { Grammarly, isAckResponse } from '@/server/grammarly/Grammarly';
import { UA } from '@/server/grammarly/GrammarlyAuth';

export class GrammarlyError extends Error {
  constructor(public readonly code: number, message: string) {
    super(message);
  }
}

export class GrammarlyWebSocketClient {
  private LOGGER = new Logger(GrammarlyWebSocketClient.name, this.id);
  private _socket: WebSocket | null = null;
  private _canReconnect = true;

  private _statusCode: WebSocketErrorCode | null = null;
  private _statusMessage: string | null = null;

  private _pendingResponses = 0;
  private _nextId: number = 0;
  private _queue: Grammarly.Request[] = [];
  private _callbacks = new Map<number, (response: Grammarly.Response) => void>();

  public readonly status: WebSocketConnectionStatus = WebSocketConnectionStatus.CLOSED;

  private _setStatus(value: WebSocketConnectionStatus) {
    this.LOGGER.trace(`WebSocket: Connection status changed: ${this.status} -> ${value}`);
    // @ts-ignore - Internally writable
    this.status = value;
  }

  constructor(
    public readonly id: string,
    private readonly _getToken: () => Promise<string> | string,
    private readonly _onConnection: () => void = () => {},
    private readonly _onMessage: (message: Grammarly.Response) => void = () => {}
  ) {
    this._connect();
  }

  public dispose() {
    this._socket?.close(WebSocketErrorCode.GOING_AWAY);
  }

  protected async send(message: Grammarly.Request, priority: boolean = false): Promise<any> {
    const request: Grammarly.Request = { ...message, id: this._nextId };

    this._nextId += 1;
    return new Promise((resolve) => {
      this._callbacks.set(request.id, (response) => resolve(response));

      this._queueOrSend(request, priority);
    });
  }

  protected async forceReConnect() {
    this.LOGGER.trace('[FORCE] Reconnect to CAPI');
    this._canReconnect = true;
    return this._connect();
  }

  private async _connect() {
    this.LOGGER.trace('Connect: Initiate CAPI connection');
    if (this.status === WebSocketConnectionStatus.CONNECTING) {
      this.LOGGER.trace('Connect: Another request in progress');
      return;
    }

    if (this._socket) {
      this.LOGGER.trace('Connect: Already connected');
      return;
    }

    if (!this._canReconnect) {
      this.LOGGER.trace(`Connect: Aborting due to pre-existing error - ${this._statusCode}: ${this._statusMessage}`);
      throw new GrammarlyError(this._statusCode!, `Socket connection failed: ${this._statusMessage}`);
    }

    this._pendingResponses = 0;
    this._nextId = 0;
    this._queue = [];
    this._setStatus(WebSocketConnectionStatus.CONNECTING);
    this._statusCode = null;
    this._statusMessage = null;
    this._socket = new WebSocket('wss://capi.grammarly.com/freews', {
      headers: { 'User-Agent': `${UA} (VS Code)`, Accept: 'application/json', Cookie: await this._getToken() },
    });

    this._socket.onopen = () => {
      this.LOGGER.trace('WebSocket: Connection established.');
      this._setStatus(WebSocketConnectionStatus.CONNECTED);
      this._queue.length = 0;
      this._onConnection();
      this._flushQueue();
    };

    this._socket.onclose = (event) => {
      this.LOGGER.trace(`WebSocket: Connection closed - ${event.code}: ${event.reason}`);
      this._socket = null;

      switch (event.code) {
        case WebSocketErrorCode.BAD_REQUEST:
        case WebSocketErrorCode.GOING_AWAY:
        case WebSocketErrorCode.UNAUTHORIZED:
          this._canReconnect = false;
          break;
        case WebSocketErrorCode.CLOSED_ABNORMALLY:
        case WebSocketErrorCode.SERVER_ERROR:
        case WebSocketErrorCode.SERVER_SHUTDOWN:
          this._canReconnect = true;
          break;
        default:
          this._canReconnect = true;
          break;
      }

      this._statusCode = event.code;
      this._statusMessage = event.reason;

      if (this.status !== WebSocketConnectionStatus.ERRORED) {
        this._setStatus(WebSocketConnectionStatus.CLOSED);
      }
    };

    this._socket.onmessage = (event) => {
      this.LOGGER.trace(`WebSocket: Message - ${event.type}`);

      try {
        const response = JSON.parse(event.data.toString());

        this._handleMessage(response);
      } catch (error) {
        this.LOGGER.error('WebSocket: Failed to parse response -', error);
      }
    };

    this._socket.onerror = (event) => {
      this.LOGGER.error(`WebSocket: Error - ${event.type}: ${event.message}`, event.error);
      this._setStatus(WebSocketConnectionStatus.ERRORED);
    };
  }

  private _queueOrSend(message: Grammarly.Request, priority: boolean) {
    this.LOGGER.debug(`WebSocket: Send(${message.id}): ${message.action}`);
    if (!this._socket) {
      this._connect();
      this._queueMessage(message);
    } else if (message.action === Grammarly.RequestKind.START) {
      this._sendStartMessage(message as Grammarly.Message.Start);
    } else if (this.status === WebSocketConnectionStatus.READY) {
      this._sendAnyMessage(message, priority);
    } else {
      this._queueMessage(message);
    }
  }

  /**
   * Ensure socket is in ready state.
   */
  private _sendAnyMessage(message: Grammarly.Request, priority: boolean) {
    if (this._pendingResponses <= 0 || priority) {
      this._sendToSocket(message);
    } else {
      this._queueMessage(message);
    }
  }

  private _sendStartMessage(message: Grammarly.Message.Start) {
    if (this.status === WebSocketConnectionStatus.CONNECTED) {
      this._sendToSocket(message);
    } else {
      this._queueMessage(message, true);
    }
  }

  private _queueMessage(message: Grammarly.Request, atStart = false) {
    this.LOGGER.trace(`CAPI: Queue(${message.id}) — ${message.action}`);
    if (atStart) this._queue.unshift(message);
    else this._queue.push(message);
  }

  private _sendToSocket(message: Grammarly.Request) {
    if (!this._socket) throw new Error(`InternalError: sending before connection is established.`);
    this.LOGGER.debug(`CAPI: Send(${message.id}) — ${message.action}`, message);
    this._socket.send(JSON.stringify(message));
    this._pendingResponses += 1;
  }

  private _flushQueue() {
    this.LOGGER.trace(`WebSocket: Flushing queue`);
    const message = this._queue.shift();
    if (message) this._sendToSocket(message);
  }

  private _handleMessage(response: Grammarly.Response) {
    if (response.action === Grammarly.ResponseKind.START) {
      if (this.status === WebSocketConnectionStatus.CONNECTED) {
        this._setStatus(WebSocketConnectionStatus.READY);
      }
    }

    if (isAckResponse(response)) {
      this.LOGGER.debug(`CAPI: Ack(${response.id}) — ${response.action}`, response);
      this._pendingResponses -= 1;
      const callback = this._callbacks.get(response.id)!;
      try {
        callback(response);
      } catch {}

      this._callbacks.delete(response.id);
    } else {
      this.LOGGER.debug(`CAPI: Recv() — ${response.action}`, response);
    }

    try {
      this._onMessage(response);
    } catch {}

    if (isAckResponse(response)) this._flushQueue();
  }
}

export enum WebSocketErrorCode {
  GOING_AWAY = 1001,
  CLOSED_ABNORMALLY = 1006,
  SERVER_ERROR = 1011,
  BAD_REQUEST = 4000,
  UNAUTHORIZED = 4001,
  SERVER_SHUTDOWN = 4002,
}

export enum WebSocketConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  READY = 'ready',
  ERRORED = 'errored',
  CLOSED = 'closed',
}
