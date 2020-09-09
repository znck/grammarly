import { Registerable } from '@/interfaces';
import { ConfigurationService } from '@/server/services/configuration';
import { injectable } from 'inversify';
import { Disposable } from 'vscode-languageserver';

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
