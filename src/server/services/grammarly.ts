import { Registerable } from '@/interfaces';
import { DocumentStatistics, GrammarlyServerFeatures } from '@/protocol';
import { CONNECTION, SERVER } from '@/server/constants';
import { inject, injectable } from 'inversify';
import {
  CodeAction,
  CodeActionParams,
  Connection,
  Diagnostic,
  Disposable,
  Hover,
  HoverParams,
  ServerCapabilities,
  DiagnosticSeverity,
} from 'vscode-languageserver';
import { Grammarly } from '../grammarly';
import { GrammarlyDocument } from '../grammarly/document';
import {
  createAddToDictionaryFix,
  createDiagnostic,
  createGrammarlyFix,
  createGrammarlySynonymFix,
  createIgnoreFix,
  getMarkdownDescription,
  getRangeInDocument,
  isSpellingAlert,
} from '../helpers';
import { DictionaryService } from './dictionary';
import { DocumentService } from './document';
import { ConfigurationService } from './configuration';
import createDebugger from 'debug';

const debug = createDebugger('grammarly:server/service/grammarly');

interface DocumentDiagnostic {
  alerts: Record<number, Grammarly.Alert>;
  diagnostics: Record<number, Diagnostic>;
  severity: Record<string, DiagnosticSeverity>;
  overallScore: number;
  scores: Grammarly.FinishedResponse['outcomeScores'];
  ignoredTags: string[];
}

@injectable()
export class GrammarlyService implements Registerable, GrammarlyServerFeatures {
  private diagnostics = new Map<string, DocumentDiagnostic>();
  private synonyms = new Map<string, Grammarly.TokenMeaning[]>();

  constructor(
    @inject(CONNECTION) private readonly connection: Connection,
    @inject(SERVER)
    private readonly capabilities: ServerCapabilities,
    private readonly documents: DocumentService,
    private readonly dictionary: DictionaryService,
    private readonly configuration: ConfigurationService
  ) {}

  register() {
    this.capabilities.hoverProvider = true;
    this.capabilities.codeActionProvider = true;

    this.connection.onHover(this.onHover.bind(this));
    this.connection.onCodeAction(this.onCodeAction.bind(this));
    this.documents.onDidOpen(this.initDocumentDiagnostics.bind(this));
    this.documents.onDidClose(this.disposeDocumentDiagnostics.bind(this));
    this.connection.onRequest('$/check', this.check.bind(this));
    this.connection.onRequest('$/dismissAlert', this.dismissAlert.bind(this));
    this.connection.onRequest(
      '$/addToDictionary',
      this.addToDictionary.bind(this)
    );
    this.connection.onRequest('$/getSummary', this.getSummary.bind(this));
    this.connection.onRequest('$/getStatistics', this.getStatistics.bind(this));

    return Disposable.create(() => {
      this.diagnostics.clear();
      this.synonyms.clear();
    });
  }

  async getSummary(uri: string) {
    const document = this.documents.get(uri);
    const state = this.diagnostics.get(uri);
    if (!document || !state) return null;

    return {
      overall: state.overallScore,
      scores: state.scores,
      username: document.host!.isAuthenticated
        ? document.host!.authParams!.username
        : undefined,
    };
  }

  async check(uri: string) {
    const document = this.documents.get(uri);
    if (!document) return;
    const state = this.diagnostics.get(uri);
    if (state) {
      state.alerts = {};
      state.diagnostics = {};
    }

    document.host!.refresh();
  }

  async dismissAlert(uri: string, alertId: number) {
    const document = this.documents.get(uri);
    if (!document) return;

    document.host!.dismissAlert(alertId);
  }

  async addToDictionary(uri: string, alertId: number) {
    const document = this.documents.get(uri);
    if (!document) return;

    document.host!.addToDictionary(alertId);
  }

  async getStatistics(uri: string): Promise<DocumentStatistics | null> {
    const document = this.documents.get(uri);
    const state = this.diagnostics.get(uri);
    if (!document || !state) return null;

    const response = await document.host!.getTextStats();

    return {
      performance: {
        score: state.overallScore,
      },
      content: {
        characters: response.chars,
        words: response.words,
        sentences: response.sentences,

        readingTime: calculateTime(response.words, 250),
        speakingTime: calculateTime(response.words, 130),
      },
      readability: {
        message: response.readabilityDescription,
        score: response.readabilityScore,

        wordLength: response.wordLength,
        sentenceLength: response.sentenceLength,
      },
      vocubulary: {
        rareWords: response.rareWords,
        uniqueWords: response.uniqueWords,
      },
    };
  }

  private async onCodeAction({
    context,
    range,
    textDocument,
  }: CodeActionParams): Promise<CodeAction[] | null> {
    const document = this.documents.get(textDocument.uri);
    const state = this.diagnostics.get(textDocument.uri);
    if (!document || !state) return null;

    const folders = await this.connection.workspace.getWorkspaceFolders();
    const isWorkspace = !!folders && folders.length > 1;
    const isAuthenticated = document.host!.isAuthenticated;

    const actions: CodeAction[] = [];
    const alerts: Grammarly.Alert[] = context.diagnostics
      .map(diagnostic => state.alerts[diagnostic.code as number])
      .filter(Boolean);

    alerts.forEach(alert => {
      alert.replacements.map(replacement =>
        actions.push(createGrammarlyFix(document, alert, replacement))
      );
      actions.push(createIgnoreFix(document, alert));
      if (isSpellingAlert(alert)) {
        actions.push(createAddToDictionaryFix(document, alert, 'user'));
        actions.push(createAddToDictionaryFix(document, alert, 'folder'));
        if (isWorkspace) {
          actions.push(createAddToDictionaryFix(document, alert, 'workspace'));
        }
        if (isAuthenticated) {
          actions.push(createAddToDictionaryFix(document, alert, 'Grammarly'));
        }
      }
    });

    const word = document.getText(range);
    if (word && /^[a-z]+$/.test(word)) {
      if (!this.synonyms.has(word)) {
        await document.host!.synonyms(document.offsetAt(range.start), word);
      }

      const synonyms = this.synonyms.get(word);
      if (synonyms) {
        synonyms.forEach(meaning => {
          meaning.synonyms.forEach(replacement => {
            actions.push(
              createGrammarlySynonymFix(document, word, replacement, range)
            );
          });
        });
      }
    }

    return actions;
  }

  private onHover({ position, textDocument }: HoverParams) {
    const document = this.documents.get(textDocument.uri);
    const state = this.diagnostics.get(textDocument.uri);
    if (!document || !state) return null;

    const offset = document.offsetAt(position);
    const alerts = Object.values(state.alerts).filter(
      alert => alert.highlightBegin <= offset && offset <= alert.highlightEnd
    );
    if (!alerts.length) return null;

    const offsetStart = Math.min(...alerts.map(alert => alert.highlightBegin));
    const offsetEnd = Math.min(...alerts.map(alert => alert.highlightEnd));

    const result: Hover = {
      range: getRangeInDocument(document, offsetStart, offsetEnd),
      contents: {
        kind: 'markdown',
        value: alerts
          .map(getMarkdownDescription)
          .filter(Boolean)
          .join('\n---\n'),
      },
    };

    debug(result);

    return result;
  }

  private disposeDocumentDiagnostics(document: GrammarlyDocument) {
    this.connection.sendDiagnostics({
      diagnostics: [],
      uri: document.uri,
      version: document.version,
    });
    this.diagnostics.delete(document.uri);
  }

  private async initDocumentDiagnostics(document: GrammarlyDocument) {
    const host = document.host;
    if (host) {
      const documentDiagnostics = this.createEmptyDocumentDiagnostics();
      documentDiagnostics.severity = await this.configuration.getAlertSeverity(
        document.uri
      );
      documentDiagnostics.ignoredTags.push(
        ...(await this.configuration.getIgnoredTags(
          document.uri,
          document.languageId
        ))
      );

      this.diagnostics.set(document.uri, documentDiagnostics);
      host.on(Grammarly.Action.ALERT, alert => this.onAlert(document, alert));
      host.on(Grammarly.Action.REMOVE, alert =>
        this.onRemoveAlert(document, alert)
      );
      host.on(Grammarly.Action.FEEDBACK, result => {
        this.onFeedback(document, result);
        this.connection.sendNotification(Grammarly.Action.FEEDBACK, [
          document.uri,
          result,
        ]);
      });
      host.on(Grammarly.Action.FINISHED, result => {
        this.onFinished(document, result);
        this.connection.sendNotification(Grammarly.Action.FINISHED, [
          document.uri,
          result,
        ]);
      });
      host.on(Grammarly.Action.SYNONYMS, result => {
        this.synonyms.set(result.token, result.synonyms.meanings);
      });
    }
  }

  private createEmptyDocumentDiagnostics(): DocumentDiagnostic {
    return {
      alerts: {},
      diagnostics: {},
      severity: {},
      overallScore: 0,
      scores: {
        Clarity: 0,
        Correctness: 0,
        Engagement: 0,
        GeneralScore: 0,
        Tone: 0,
      },
      ignoredTags: [],
    };
  }

  private onFinished(
    document: GrammarlyDocument,
    result: Grammarly.FinishedResponse
  ): void {
    const state = this.diagnostics.get(document.uri);
    if (!state) return;

    state.overallScore = result.generalScore;
    state.scores = result.outcomeScores;

    this.sendDiagnostics(document);
  }

  private onFeedback(
    document: GrammarlyDocument,
    result: Grammarly.FeedbackResponse
  ): void {
    const state = this.diagnostics.get(document.uri);
    if (!state) return;

    state.scores = {
      ...state.scores,
      ...result.scores,
    };

    const scores = Object.values(state.scores);
    if (scores.every(score => score === 1)) {
      state.alerts = {};
      state.overallScore = 100;
      this.sendDiagnostics(document);
    }
  }

  private onRemoveAlert(
    document: GrammarlyDocument,
    alert: Grammarly.RemoveAlertResponse
  ): void {
    const state = this.diagnostics.get(document.uri);
    if (!state) return;

    delete state.alerts[alert.id];
    delete state.diagnostics[alert.id];

    this.sendDiagnostics(document);
  }

  private sendDiagnostics(document: GrammarlyDocument) {
    const state = this.diagnostics.get(document.uri);
    if (!state) return;

    this.connection.sendDiagnostics({
      uri: document.uri,
      version: document.version,
      diagnostics: Object.values(state.diagnostics),
    });
  }

  private onAlert(
    document: GrammarlyDocument,
    alert: Grammarly.AlertResponse
  ): void {
    const state = this.diagnostics.get(document.uri);

    if (!state) return;

    state.alerts[alert.id] = alert;

    if (isSpellingAlert(alert)) {
      if (this.dictionary.isKnownWord(alert.text)) {
        document.host!.dismissAlert(alert.id);
      }
    }

    if (document.inIgnoredRange([alert.begin, alert.end], state.ignoredTags)) {
      document.host!.dismissAlert(alert.id);
    }

    if (alert.hidden) {
      document.host!.dismissAlert(alert.id);
    } else {
      state.diagnostics[alert.id] = createDiagnostic(
        document,
        alert,
        state.severity
      );
    }
  }
}

function calculateTime(words: number, wordsPerMinute: number) {
  const _ = words / wordsPerMinute;
  const hours = Math.floor(_ / 60);
  const seconds = Math.floor((_ * 60) % 60);
  const minutes = Math.floor(_ % 60);

  const hours_str = `${hours} hr`;
  const minutes_str = `${minutes} min`;
  const seconds_str = `${seconds} sec`;

  return [
    hours > 0 ? hours_str : '',
    minutes > 0 ? minutes_str : '',
    seconds > 0 && hours === 0 ? seconds_str : '',
  ]
    .join(' ')
    .trim();
}
