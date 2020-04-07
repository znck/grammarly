import { expect } from 'chai';
import { before, suite, teardown, test } from 'mocha';
import vscode from 'vscode';
import {
  executeCodeActionProvider,
  findMisspelledWord,
  getDiagnostics,
  getFile,
  openFile,
} from './utils';

suite('Language Server', function () {
  before(async () => {
    await vscode.extensions.getExtension('znck.grammarly').activate();
  });

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.files.revert');
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('CodeAction: add to dictionary', async function () {
    const document = (await openFile(getFile('folder/add-word.md'))).document;
    expect(vscode.window.activeTextEditor?.document).to.equal(document);
    const diagnostics = await getDiagnostics(
      document.uri,
      (diagnostics) => !!findMisspelledWord(diagnostics, 'inversifyjs')
    );
    const diagnostic = findMisspelledWord(diagnostics, 'inversifyjs')!;
    const actions = await executeCodeActionProvider(
      document.uri,
      diagnostic.range
    );

    {
      const action = actions!.find((action) =>
        action.title.includes('Grammarly: add "inversifyjs" to user dictionary')
      );
      expect(action.command.command).to.be.equal('grammarly.addWord');
      expect(action.command.arguments[0]).to.be.equal('user');
      expect(action.command.arguments[3]).to.be.equal('inversifyjs');
    }
    {
      const action = actions!.find((action) =>
        action.title.includes(
          'Grammarly: add "inversifyjs" to folder dictionary'
        )
      );
      expect(action.command.command).to.be.equal('grammarly.addWord');
      expect(action.command.arguments[0]).to.be.equal('folder');
      expect(action.command.arguments[3]).to.be.equal('inversifyjs');
    }
  });
});
