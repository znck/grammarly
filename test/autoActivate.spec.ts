import { expect } from 'chai';
import { before, suite, teardown, test } from 'mocha';
import vscode from 'vscode';
import {
  findMisspelledWord,
  getDiagnostics,
  getFile,
  openFile,
  resetVSCodeFolder,
  sleep,
} from './utils';

suite('AutoEnable', function () {
  before(async () => {
    await vscode.extensions.getExtension('znck.grammarly').activate();
  });

  teardown(async () => {
    resetVSCodeFolder();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('on', async () => {
    const document = (await openFile(getFile('folder/autoActivate.on.md')))
      .document;
    const diagnostics = await getDiagnostics(
      document.uri,
      (diagnostics) => !!findMisspelledWord(diagnostics, 'inversifyjs')
    );

    expect(diagnostics).to.have.length.greaterThan(0);
  });

  test('off', async () => {
    await vscode.workspace
      .getConfiguration('grammarly')
      .update('autoActivate', false);

    await sleep();
    expect(vscode.window.activeTextEditor).to.be.undefined;
    const document = (await openFile(getFile('folder/autoActivate.off.md')))
      .document;

    const fn = async () => {
      try {
        return await getDiagnostics(
          document.uri,
          (diagnostics) => !!findMisspelledWord(diagnostics, 'inversifyjs')
        );
      } catch (error) {
        expect(error.message).to.equal(
          'Did not recevies any diagnostics after 10000ms.'
        );
        return [];
      }
    };

    const diagnostics = await fn();
    expect(diagnostics).to.have.length(0);
  });
});
