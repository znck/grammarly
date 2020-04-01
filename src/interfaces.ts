import { Disposable } from 'vscode';

export interface Registerable {
  register(): Disposable;
}
