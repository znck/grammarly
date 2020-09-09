import { Grammarly } from '@/server/grammarly/Grammarly';
import { GrammarlyWebSocketClient } from '@/server/grammarly/GrammarlyWebSocketClient';

type Payload<T extends Grammarly.Request, K extends keyof T = never> = Omit<T, 'id' | 'action' | K>;

export class GrammarlyAPI extends GrammarlyWebSocketClient {
  constructor(
    id: string,
    getToken: () => Promise<string> | string,
    onConnection: () => void,
    onMessage: (message: Grammarly.Response) => void,
    private readonly onError: (error: Error) => void
  ) {
    super(id, getToken, onConnection, onMessage);
  }

  public reconnect() {
    this.forceReConnect();
  }

  private async sendWithErrorHandling(request: Grammarly.Request, priority = false) {
    try {
      return await this.send(request, priority);
    } catch (error) {
      this.onError(error);
      throw error;
    }
  }

  async ping() {
    return this.send({ id: 0, action: Grammarly.RequestKind.PING });
  }

  async start(
    message: Omit<Payload<Grammarly.Message.Start>, 'client' | 'clientSubtype' | 'clientSupports' | 'clientVersion'>
  ): Promise<Grammarly.Message.StartAck> {
    return this.send({
      ...message,
      id: 0,
      action: Grammarly.RequestKind.START,
      client: 'denali_editor',
      clientSubtype: 'general',
      clientSupports: [
        Grammarly.Feature.ALERTS_CHANGES,
        Grammarly.Feature.ALERTS_UPDATE,
        Grammarly.Feature.COMPLETIONS,
        Grammarly.Feature.CONSISTENCY_CHECK,
        Grammarly.Feature.EMOGENIE_CHECK,
        Grammarly.Feature.FILLER_WORDS_CHECK,
        Grammarly.Feature.FREE_CLARITY_ALERTS,
        Grammarly.Feature.FREE_INLINE_ADVANCED_ALERTS,
        Grammarly.Feature.FULL_SENTENCE_REWRITE_CARD,
        Grammarly.Feature.KEY_TAKEAWAYS,
        Grammarly.Feature.MUTE_QUOTED_ALERTS,
        Grammarly.Feature.PLAGIARISM_ALERTS_UPDATE,
        Grammarly.Feature.READABILITY_CHECK,
        Grammarly.Feature.SENTENCE_VARIETY_CHECK,
        Grammarly.Feature.SET_GOALS_LINK,
        Grammarly.Feature.SUPER_ALERTS,
        Grammarly.Feature.TEXT_INFO,
        Grammarly.Feature.TONE_CARDS,
        Grammarly.Feature.USER_MUTES,
        Grammarly.Feature.VOX_CHECK,
      ],
      clientVersion: '1.5.43-2114+master',
    });
  }

  async submitOT(message: Payload<Grammarly.Message.SubmitOT>): Promise<Grammarly.Message.SubmitOTAck> {
    return this.sendWithErrorHandling({ ...message, id: 0, action: Grammarly.RequestKind.SUBMIT_OT });
  }

  async sendFeedbackForAlert(message: Payload<Grammarly.UserFeedback.Alert>): Promise<Grammarly.Message.FeedbackAck> {
    return this.sendWithErrorHandling({
      ...message,
      id: 0,
      action: Grammarly.RequestKind.FEEDBACK,
    });
  }

  async setOption(message: Payload<Grammarly.Message.Option>): Promise<Grammarly.Message.OptionAck> {
    return this.sendWithErrorHandling({ ...message, id: 0, action: Grammarly.RequestKind.OPTION });
  }

  async getTextStats(message: Payload<Grammarly.Message.GetTextStats>): Promise<Grammarly.Message.TextStats> {
    return this.sendWithErrorHandling({ ...message, id: 0, action: Grammarly.RequestKind.GET_TEXT_STATS }, true);
  }

  async getDebugInfo(message: Payload<Grammarly.Message.GetDebugInfo>): Promise<Grammarly.Message.DebugInfo> {
    return this.sendWithErrorHandling({ ...message, id: 0, action: Grammarly.RequestKind.GET_DEBUG_INFO }, true);
  }

  async getSynonyms(message: Payload<Grammarly.Message.GetSynonyms>): Promise<Grammarly.Message.Synonyms> {
    return this.sendWithErrorHandling({ ...message, id: 0, action: Grammarly.RequestKind.SYNONYMS }, true);
  }

  async setContext(message: Payload<Grammarly.Message.SetContext>): Promise<Grammarly.Message.SetContextAck> {
    return this.sendWithErrorHandling({ ...message, id: 0, action: Grammarly.RequestKind.SET_CONTEXT });
  }

  async toggleChecks(message: Payload<Grammarly.Message.ToggleChecks>): Promise<Grammarly.Message.ToggleChecksAck> {
    return this.sendWithErrorHandling({ ...message, id: 0, action: Grammarly.RequestKind.TOGGLE_CHECKS });
  }
}
