import { Registerable } from '@/interfaces';
import { injectable, inject } from 'inversify';
import { Disposable } from 'vscode-languageserver';
import { ConfigurationService } from './configuration';

@injectable()
export class DictionaryService implements Registerable {
  constructor(private readonly configuration: ConfigurationService) {}

  register() {
    return Disposable.create(() => {});
  }

  isKnownWord(word: string) {
    const words = this.configuration.settings.userWords;

    return words.includes(word) || words.includes(word.toLocaleLowerCase());
  }
}
