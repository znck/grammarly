import {
  Position,
  Range,
  TextDocument,
  TextDocumentContentChangeEvent,
  TextEdit,
} from 'vscode-languageserver-textdocument';
import { Grammarly } from '.';
import { AuthParams } from '../socket';
import { AuthCookie } from './auth';
import { parsers } from './parsers';

export class GrammarlyDocument implements TextDocument {
  private _host: Grammarly.DocumentHost | null = null;
  private _isDirty = true;
  private rangeToIdentifierFn?: (interval: [number, number]) => string[];
  private constructor(private internal: TextDocument) {}
  public changes: TextEdit[] = [];

  attachHost(
    settings: Grammarly.DocumentContext,
    auth?: AuthParams,
    cookie?: AuthCookie
  ) {
    // TODO: Switch to Cookie.
    this._host = new Grammarly.DocumentHost(this, settings, auth, cookie);
    this._host.on(Grammarly.Action.FINISHED, () => {
      this._isDirty = false;
    });
  }

  detachHost() {
    if (this._host) {
      this._host.dispose();
    }
  }

  inIgnoredRange(interval: [number, number], tags: string[]): boolean {
    if (this.isDirty) {
      const parser = parsers[this.languageId];

      if (parser) this.rangeToIdentifierFn = parser.parse(this.getText());
    }

    if (this.rangeToIdentifierFn) {
      const matched = new Set(this.rangeToIdentifierFn(interval));

      return tags.some(tag => matched.has(tag));
    }

    return false;
  }

  get isDirty() {
    return this._isDirty;
  }

  get host() {
    return this._host;
  }

  get uri() {
    return this.internal.uri;
  }

  get languageId() {
    return this.internal.languageId;
  }

  get version() {
    return this.internal.version;
  }

  getText(range?: Range): string {
    return this.internal.getText(range);
  }

  positionAt(offset: number): Position {
    return this.internal.positionAt(offset);
  }

  offsetAt(position: Position): number {
    return this.internal.offsetAt(position);
  }

  get lineCount() {
    return this.internal.lineCount;
  }

  static create(
    uri: string,
    languageId: string,
    version: number,
    content: string
  ): GrammarlyDocument {
    return new GrammarlyDocument(
      TextDocument.create(uri, languageId, version, content)
    );
  }

  static update(
    document: GrammarlyDocument,
    changes: TextDocumentContentChangeEvent[],
    version: number
  ): GrammarlyDocument {
    document._isDirty = true;
    if (document._host) {
      let prevContent = document.getText();
      changes.forEach(change => {
        if ('range' in change) {
          const offsetStart = document.offsetAt(change.range.start);
          const offsetEnd = document.offsetAt(change.range.end);
          const deleteLength = offsetEnd - offsetStart;

          if (deleteLength) {
            document._host!.delete(
              prevContent.length,
              deleteLength,
              offsetStart
            );
          }

          document._host!.insert(
            prevContent.length - deleteLength,
            change.text,
            offsetStart
          );

          const edit = { range: change.range, newText: change.text };
          prevContent = TextDocument.applyEdits(document.internal, [edit]);
        } else {
          document._host!.insert(prevContent.length, change.text);
          prevContent = change.text;
        }
      });
    }

    document.internal = TextDocument.update(
      document.internal,
      changes,
      version
    );

    if (document._host) {
      changes.forEach(change => {
        if ('range' in change) {
          const edit = { range: change.range, newText: change.text };
          document._host!.emit('$/change', edit);
        }
      });
    }

    return document;
  }
}
