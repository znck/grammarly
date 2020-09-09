import { Grammarly } from '@/server/grammarly/Grammarly';
import { GrammarlyAPI } from '@/server/grammarly/GrammarlyAPI';
import { GrammarlyAuthContext } from '@/server/grammarly/GrammarlyAuth';
import { GrammarlyError } from '@/server/grammarly/GrammarlyWebSocketClient';
import { Logger } from '@/utils/Logger';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ref, readonly } from '@vue/reactivity';

type ResponseFor<T extends Grammarly.ResponseKind> = Extract<Grammarly.Response, { action: T }>;

export enum GrammarlyStatus {
  CHECKING,
  IDLE,
}

export class TextGrammarCheckHost {
  private id: string;
  private api: GrammarlyAPI;
  private offsetVersion: number = 0;
  private events = new EventEmitter({ captureRejections: true });
  private auth: GrammarlyAuthContext | null = null;
  private LOGGER: Logger;
  private remoteRevision!: Grammarly.Revision;

  public alerts = ref(new Map<Grammarly.Alert.Id, Grammarly.Alert>());
  public user = ref<{ isAnonymous: boolean; isPremium: boolean }>({ isAnonymous: true, isPremium: false });

  public score = ref(-1);
  public generalScore = ref(-1);
  public status = ref(GrammarlyStatus.IDLE);
  public scores = ref<Partial<Grammarly.OutcomeScoresWithPlagiarism>>({});
  public emotions = ref<Grammarly.Emogenie.Emotion[]>([]);
  public textInfo = ref<Grammarly.Message.TextInfo | null>(null);

  private disposables: Array<() => void> = [];

  public constructor(
    private readonly document: TextDocument,
    public readonly getDocumentContext: () => Promise<Grammarly.DocumentContext>,
    public readonly getTokenInfo: () => Promise<GrammarlyAuthContext>,
    private readonly onError: (error: Error) => void
  ) {
    this.id = crypto.createHash('md5').update(this.document.uri).digest('hex');
    this.LOGGER = new Logger(TextGrammarCheckHost.name, this.id);
    this.api = new GrammarlyAPI(
      this.id,
      async () => {
        this.auth = await this.getTokenInfo();

        return this.auth.token;
      },
      async () => {
        const context = await this.getDocumentContext();
        this.offsetVersion = this.document.version;
        await this.api.start({ documentContext: context, docid: this.id, dialect: context.dialect });
        await this.api.setOption({
          name: Grammarly.OptionType.GNAR_CONTAINER_ID,
          value: this.auth!.container,
        });
        await this.edit(0).setText(this.document.getText()).apply();
      },
      (message) => this.events.emit(message.action, message),
      (error) => {
        this.onError(error);

        if (error instanceof GrammarlyError) {
          if (error.code === 4000) {
            this.api.ping();
          }
        }
      }
    );

    this.LOGGER.debug(`Hosting ${document.uri}`);
    this.on(Grammarly.ResponseKind.ALERT, (alert) => this.alerts.value.set(alert.id, alert));
    this.on(Grammarly.ResponseKind.REMOVE, (alert) => this.alerts.value.delete(alert.id));
    this.on(Grammarly.ResponseKind.SUBMIT_OT, (message) => {
      this.remoteRevision = message.rev;
      this.LOGGER.trace(
        `Local: ${this.getLocalRevision()}, Remote: ${this.remoteRevision}, Version: ${this.document.version}`
      );
    });
    this.on(Grammarly.ResponseKind.EMOTIONS, (message) => {
      this.emotions.value = message.emotions;
    });
    this.on(Grammarly.ResponseKind.FINISHED, (message) => {
      this.status.value = GrammarlyStatus.IDLE;
      if (message.outcomeScores) {
        this.scores.value = message.outcomeScores;
      }
      this.score.value = message.score;
      if (message.generalScore) {
        this.generalScore.value = message.generalScore;
      }
    });
    this.on(Grammarly.ResponseKind.TEXT_INFO, (message) => {
      this.textInfo.value = message;
    });
    this.on(Grammarly.ResponseKind.TEXT_INFO, (message) => {
      this.textInfo.value = message;
    });
  }

  public get context(): Omit<GrammarlyAuthContext, 'token'> {
    return this.auth || { username: 'anonymous', isAnonymous: true, container: '' }; // TODO: Get user info from API.
  }

  public on<T extends Grammarly.ResponseKind>(action: T, callback: (message: ResponseFor<T>) => void) {
    this.events.on(action, callback);
    return () => this.off(action, callback);
  }

  public off<T extends Grammarly.ResponseKind>(action: T, callback: (message: ResponseFor<T>) => void) {
    this.events.off(action, callback);
  }

  public once<T extends Grammarly.ResponseKind>(action: T, callback: (message: ResponseFor<T>) => void) {
    this.events.once(action, callback);
  }

  public onTextChange(callback: (event: { rev: Grammarly.Revision; changes: Grammarly.OT.TextChange[] }) => void) {
    this.events.on('change', callback);

    return () => this.events.off('change', callback);
  }

  private getLocalRevision(version = this.document.version) {
    return Grammarly.getRevision(version - this.offsetVersion);
  }

  public onDispose(fn: () => void) {
    this.disposables.push(fn);
  }

  public dispose() {
    this.disposables.forEach((dispose) => {
      try {
        dispose();
      } catch {}
    });
    this.api.dispose();
    this.events.removeAllListeners();
  }

  public edit(doc_len = this.document.getText().length, nextVersion?: number): Grammarly.OT.ChangeSet {
    const rev = this.getLocalRevision(nextVersion);

    return new Grammarly.OT.ChangeSet(async (deltas, changes) => {
      this.LOGGER.trace(`Local: ${rev}, Remote: ${this.remoteRevision}, Version: ${this.document.version}`);
      this.events.emit('change', { rev, changes });
      this.status.value = GrammarlyStatus.CHECKING;
      await this.api.submitOT({ rev, doc_len, deltas, chunked: false });
    });
  }

  public async getSynonyms(offset: number, word: string) {
    const result = await this.api.getSynonyms({ begin: offset, token: word });

    return result.synonyms;
  }

  public async getTextStats() {
    return this.api.getTextStats({});
  }

  public getAlert(id: Grammarly.Alert.Id) {
    return this.alerts.value.get(id);
  }

  public async addToDictionary(_: Grammarly.Alert.Id) {
    // TODO
  }

  public async dismissAlert(_: Grammarly.Alert.Id) {
    // TODO
  }

  public async acceptAlert(alertId: Grammarly.Alert.Id, text?: string) {
    this.api.sendFeedbackForAlert({ type: Grammarly.UserFeedback.AlertFeedbackType.ACCEPTED, text, alertId });
  }

  public async setDocumentContext(documentContext: Grammarly.DocumentContext) {
    await this.api.setContext({ rev: 1 as Grammarly.Revision, documentContext });
  }
}
