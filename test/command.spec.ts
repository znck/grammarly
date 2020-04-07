import { expect } from 'chai';
import { before, suite, teardown, test } from 'mocha';
import vscode from 'vscode';
import {
  getFile,
  getUserWords,
  getUserWordsForDocument,
  resetVSCodeFolder,
} from './utils';

suite('Commands', function () {
  before(async () => {
    await vscode.extensions.getExtension('znck.grammarly').activate();
  });

  teardown(async () => {
    resetVSCodeFolder();
  });

  test('grammarly.addWord: user dictionary', async () => {
    const word = 'word' + Date.now();
    expect(getUserWords()).to.not.include(word);
    await vscode.commands.executeCommand(
      'grammarly.addWord',
      'user',
      '',
      0,
      word
    );
    expect(getUserWords()).to.include(word);
  });

  test('grammarly.addWord: folder dictionary', async () => {
    const word = 'word' + Date.now();
    const uri = vscode.Uri.file(getFile('folder/add-word.md'));
    expect(getUserWordsForDocument(uri)).to.not.include(word);
    await vscode.commands.executeCommand(
      'grammarly.addWord',
      'folder',
      uri.toString(),
      0,
      word
    );
    expect(getUserWordsForDocument(uri)).to.include(word);
  });
});
