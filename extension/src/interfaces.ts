import { Disposable } from 'vscode';

export interface Registerable {
  register(): Disposable;
}

export interface AuthParams {
  username: string;
  password: string;
}
