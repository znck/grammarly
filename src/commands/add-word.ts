import { GrammarlyClient } from '@/client';
import { Registerable } from '@/interfaces';
import { injectable } from 'inversify';
import vscode, { commands, ConfigurationTarget, Uri, workspace } from 'vscode';

@injectable()
export class AddWordCommand implements Registerable {
  constructor(private readonly client: GrammarlyClient) {}

  register() {
    return commands.registerCommand(
      'grammarly.add-word',
      this.execute.bind(this)
    );
  }

  private async execute(
    target: 'grammarly' | 'workspace' | 'folder' | 'user',
    documentURI: string,
    code: number,
    word: string
  ) {
    if (!this.client.isReady()) return;

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
        await this.client.addToDictionary(documentURI, code);
        break;
    }

    if (target !== 'grammarly') {
      await this.client.dismissAlert(documentURI, code);
    }
  }
}

async function addToUserDictionary(word: string) {
  const config = workspace.getConfiguration('grammarly');
  const words = config.get<string[]>('userWords') || [];

  words.sort();

  if (!words.includes(word)) {
    await config.update('userWords', words, ConfigurationTarget.Global);
  }
}

async function addToFolderDictionary(uri: string, word: string) {
  const config = workspace.getConfiguration('grammarly', Uri.parse(uri));
  const words = config.get<string[]>('userWords') || [];

  words.sort();

  if (!words.includes(word)) {
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

  words.sort();

  if (!words.includes(word)) {
    await config.update('userWords', words, ConfigurationTarget.Workspace);
  }
}
