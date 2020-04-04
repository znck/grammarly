import { GrammarlyClient } from '@/client';
import { Registerable } from '@/interfaces';
import { injectable } from 'inversify';
import vscode, { commands, ConfigurationTarget, Uri, workspace } from 'vscode';

@injectable()
export class AddWordCommand implements Registerable {
  constructor(private readonly client: GrammarlyClient) {}

  register() {
    return commands.registerCommand(
      'grammarly.addWord',
      this.execute.bind(this)
    );
  }

  private async execute(
    target: 'grammarly' | 'workspace' | 'folder' | 'user',
    documentURI: string,
    code: number,
    word: string
  ) {
    switch (target) {
      case 'folder':
        await addToFolderDictionary(documentURI, word);
        break;

      case 'workspace':
        await addToWorkspaceDictionary(documentURI, word);
        break;

      case 'user':
        await addToUserDictionary(word);
        break;

      case 'grammarly':
        if (this.client.isReady()) {
          vscode.window.showInformationMessage(
            `Grammarly service is not ready for adding the word "${word}" to the dictionary.`
          );

          return;
        }
        await this.client.addToDictionary(documentURI, code);
        await this.client.dismissAlert(documentURI, code);
        break;
    }
  }
}

async function addToUserDictionary(word: string) {
  const config = workspace.getConfiguration('grammarly');
  const words = config.get<string[]>('userWords') || [];

  if (!words.includes(word)) {
    words.push(word);
    words.sort();

    await config.update('userWords', words, ConfigurationTarget.Global);
  }
}

async function addToFolderDictionary(uri: string, word: string) {
  const config = workspace.getConfiguration('grammarly', Uri.parse(uri));
  const words = config.get<string[]>('userWords') || [];

  if (!words.includes(word)) {
    words.push(word);
    words.sort();

    await config.update(
      'userWords',
      words,
      ConfigurationTarget.WorkspaceFolder
    );
  }
}

async function addToWorkspaceDictionary(uri: string, word: string) {
  const config = workspace.getConfiguration('grammarly', Uri.parse(uri));
  const words = config.get<string[]>('userWords') || [];

  if (!words.includes(word)) {
    words.push(word);
    words.sort();

    await config.update('userWords', words, ConfigurationTarget.Workspace);
  }
}
