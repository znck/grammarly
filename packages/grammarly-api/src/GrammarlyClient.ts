import { SocketClient } from './SocketClient'
import { AlertEvent } from './transport/events/AlertEvent'
import { AlertsChangedEvent } from './transport/events/AlertsChangedEvent'
import { AsyncCheckFinishedEvent } from './transport/events/AsyncCheckFinishedEvent'
import { CompleteEvent } from './transport/events/CompleteEvent'
import { EmotionsEvent } from './transport/events/EmotionsEvent'
import { FinishedEvent } from './transport/events/FinishedEvent'
import { HeatmapEvent } from './transport/events/HeatmapEvent'
import { PlagiarismEvent } from './transport/events/PlagiarismEvent'
import { RemoveEvent } from './transport/events/RemoveEvent'
import { TakeawaysEvent } from './transport/events/TakeawaysEvent'
import { TextInfoEvent } from './transport/events/TextInfoEvent'
import { TextMapsEvent } from './transport/events/TextMapsEvent'
import { AlertFeedbackRequest } from './transport/messages/AlertFeedbackRequest'
import { AlertFeedbackResponse } from './transport/messages/AlertFeedbackResponse'
import { DebugInfoRequest } from './transport/messages/DebugInfoRequest'
import { DebugInfoResponse } from './transport/messages/DebugInfoResponse'
import { OptionRequest } from './transport/messages/OptionRequest'
import { OptionResponse } from './transport/messages/OptionResponse'
import { PingResponse } from './transport/messages/PingResponse'
import { SetContextRequest } from './transport/messages/SetContextRequest'
import { SetContextResponse } from './transport/messages/SetContextResponse'
import { StartRequest } from './transport/messages/StartRequest'
import { StartResponse } from './transport/messages/StartResponse'
import { SubmitOTRequest } from './transport/messages/SubmitOTRequest'
import { SubmitOTResponse } from './transport/messages/SubmitOTResponse'
import { SynonymsRequest } from './transport/messages/SynonymsRequest'
import { SynonymsResponse } from './transport/messages/SynonymsResponse'
import { TextStatsRequest } from './transport/messages/TextStatsRequest'
import { TextStatsResponse } from './transport/messages/TextStatsResponse'
import { ToggleChecksRequest } from './transport/messages/ToggleChecksRequest'
import { ToggleChecksResponse } from './transport/messages/ToggleChecksResponse'
import { Request } from './transport/Request'
import { RequestKind } from './transport/RequestKind'
import { Event, isEvent, isResponseType, Response, ResponseOf } from './transport/Response'
import { ResponseKind } from './transport/ResponseKind'

type Payload<T extends Request> = Omit<T, 'id' | 'action'>

type EventHandler<T extends Event> = (event: T) => void
type StopEventHandler = () => void

export interface GrammarlyClientOptions {
  documentId: string
  clientName: string
  clientType: string
  clientVersion?: string

  getToken: () => Promise<string> | string
  onConnection?: () => void
  onMessage?: (message: Response) => void
  onError?: (error: Error) => void
}

function noop(): any { }

export class GrammarlyClient extends SocketClient {
  private handlers = new Set<(event: Event) => void>()

  constructor (private readonly options: GrammarlyClientOptions) {
    super(
      options.documentId,
      options.getToken,
      options.onConnection ?? noop,
      (message) => {
        if (options.onMessage != null) options.onMessage(message)
        if (isEvent(message)) {
          this.handlers.forEach((fn) => fn(message))
          if (message.action === ResponseKind.ERROR && this.options.onError != null) {
            const error = new Error(message.error)
            Object.assign(error, message)
            this.options.onError(error)
          }
        }
      },
      `Client: ${options.clientName} (${options.clientType}) v${options.clientVersion ?? '0.0.0'}`,
      {
        'x-client-type': options.clientName,
        'x-client-version': options.clientVersion ?? '0.0.0',
      }
    )
  }

  public async reconnect(): Promise<void> {
    return this.forceReConnect()
  }

  private async sendWithErrorHandling<T extends Request>(request: T, priority = false): Promise<ResponseOf<T>> {
    try {
      return await this.send(request, priority)
    } catch (error) {
      if (this.options.onError) this.options.onError(error)
      throw error
    }
  }

  public onEvent<T extends Event>(kind: T['action'], fn: EventHandler<T>): StopEventHandler {
    const handler = (event: Event) => {
      if (isResponseType(event, kind)) {
        fn(event as T)
      }
    }

    this.handlers.add(handler)

    return () => this.handlers.delete(handler)
  }

  public onAlert(fn: EventHandler<AlertEvent>): StopEventHandler {
    return this.onEvent(ResponseKind.ALERT, fn)
  }

  public onRemove(fn: EventHandler<RemoveEvent>): StopEventHandler {
    return this.onEvent(ResponseKind.REMOVE, fn)
  }

  public onAlertsChanged(fn: EventHandler<AlertsChangedEvent>): StopEventHandler {
    return this.onEvent(ResponseKind.ALERT_CHANGES, fn)
  }

  public onAsyncCheckFinished(fn: EventHandler<AsyncCheckFinishedEvent>): StopEventHandler {
    return this.onEvent(ResponseKind.ASYNC_CHECK_FINISHED, fn)
  }

  public onComplete(fn: EventHandler<CompleteEvent>): StopEventHandler {
    return this.onEvent(ResponseKind.COMPLETE, fn)
  }

  public onEmotion(fn: EventHandler<EmotionsEvent>): StopEventHandler {
    return this.onEvent(ResponseKind.EMOTIONS, fn)
  }

  public onFinished(fn: EventHandler<FinishedEvent>): StopEventHandler {
    return this.onEvent(ResponseKind.FINISHED, fn)
  }

  public onHeatmap(fn: EventHandler<HeatmapEvent>): StopEventHandler {
    return this.onEvent(ResponseKind.HEATMAP, fn)
  }

  public onPlagiarism(fn: EventHandler<PlagiarismEvent>): StopEventHandler {
    return this.onEvent(ResponseKind.PLAGIARISM, fn)
  }

  public onTakeaways(fn: EventHandler<TakeawaysEvent>): StopEventHandler {
    return this.onEvent(ResponseKind.TAKEAWAYS, fn)
  }

  public onTextInfo(fn: EventHandler<TextInfoEvent>): StopEventHandler {
    return this.onEvent(ResponseKind.TEXT_INFO, fn)
  }

  public onTextMaps(fn: EventHandler<TextMapsEvent>): StopEventHandler {
    return this.onEvent(ResponseKind.TEXT_MAPS, fn)
  }

  async ping(): Promise<PingResponse> {
    return await this.send({ id: 0, action: RequestKind.PING })
  }

  async start(
    options: Partial<Pick<StartRequest, 'dialect' | 'clientSupports' | 'documentContext'>>,
  ): Promise<StartResponse> {
    return this.send({
      dialect: 'british',
      clientSupports: [
        'alerts_changes',
        'alerts_update',
        'completions',
        'consistency_check',
        'emogenie_check',
        'filler_words_check',
        'free_clarity_alerts',
        'free_inline_advanced_alerts',
        'full_sentence_rewrite_card',
        'key_takeaways',
        'mute_quoted_alerts',
        'plagiarism_alerts_update',
        'readability_check',
        'sentence_variety_check',
        'set_goals_link',
        'super_alerts',
        'text_info',
        'tone_cards',
        'user_mutes',
        'vox_check',
      ],

      ...options,

      id: 0,
      docid: this.id,
      client: this.options.clientName,
      clientSubtype: this.options.clientType,
      clientVersion: this.options.clientVersion ?? '0.0.0',
      action: RequestKind.START,
    })
  }

  async submitOT(options: Payload<SubmitOTRequest>): Promise<SubmitOTResponse> {
    return this.sendWithErrorHandling({ ...options, id: 0, action: RequestKind.SUBMIT_OT })
  }

  async sendFeedbackForAlert(message: Payload<AlertFeedbackRequest>): Promise<AlertFeedbackResponse> {
    return this.sendWithErrorHandling({
      ...message,
      id: 0,
      action: RequestKind.FEEDBACK,
    }) as any
  }

  async setOption(message: Payload<OptionRequest>): Promise<OptionResponse> {
    return this.sendWithErrorHandling({ ...message, id: 0, action: RequestKind.OPTION })
  }

  async setContext(message: Payload<SetContextRequest>): Promise<SetContextResponse> {
    return this.sendWithErrorHandling({ ...message, id: 0, action: RequestKind.SET_CONTEXT })
  }

  async toggleChecks(message: Payload<ToggleChecksRequest>): Promise<ToggleChecksResponse> {
    return this.sendWithErrorHandling({ ...message, id: 0, action: RequestKind.TOGGLE_CHECKS })
  }

  async getTextStats(message: Payload<TextStatsRequest>): Promise<TextStatsResponse> {
    return this.sendWithErrorHandling({ ...message, id: 0, action: RequestKind.TEXT_STATS }, true)
  }

  async getDebugInfo(message: Payload<DebugInfoRequest>): Promise<DebugInfoResponse> {
    return this.sendWithErrorHandling({ ...message, id: 0, action: RequestKind.DEBUG_INFO }, true)
  }

  async getSynonyms(message: Payload<SynonymsRequest>): Promise<SynonymsResponse> {
    return this.sendWithErrorHandling({ ...message, id: 0, action: RequestKind.SYNONYMS }, true)
  }
}
