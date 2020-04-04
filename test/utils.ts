import Fs from 'fs';
import Path from 'path';
import vscode from 'vscode';
export async function executeCodeActionProvider(
  uri: vscode.Uri,
  range: vscode.Range
) {
  return vscode.commands.executeCommand<vscode.CodeAction[]>(
    'vscode.executeCodeActionProvider',
    uri,
    range
  );
}
export async function openFile(fileName: string) {
  const document = await vscode.workspace.openTextDocument(
    vscode.Uri.file(fileName)
  );
  return vscode.window.showTextDocument(document);
}
export function range(start: [number, number], end: [number, number] = start) {
  return new vscode.Range(position(...start), position(...end));
}
export function position(line: number, character: number) {
  return new vscode.Position(line, character);
}
export function findMisspelledWord(
  diagnostics: vscode.Diagnostic[],
  word: string
) {
  return diagnostics.find((diagnostic) =>
    diagnostic.message.includes('Misspelled word: ' + word)
  );
}
export function getUserWords() {
  return vscode.workspace
    .getConfiguration('grammarly')
    .get<string[]>('userWords');
}
export function getUserWordsForDocument(uri: vscode.Uri) {
  return vscode.workspace
    .getConfiguration('grammarly', uri)
    .get<string[]>('userWords');
}
export function getFile(fileName: string) {
  return Path.resolve(__dirname, '../fixtures/', fileName);
}
export async function sleep(timeInMs = 200) {
  return new Promise<void>((resolve) => setTimeout(resolve, timeInMs));
}
export async function getDiagnostics(
  uri: vscode.Uri,
  check = (diagnostics: vscode.Diagnostic[]) => diagnostics.length > 0,
  timeout = 10000
) {
  const startedAt = Date.now();
  let time = 200;
  do {
    await sleep(time);
    try {
      const result = vscode.languages.getDiagnostics(uri);
      if (check(result)) {
        return result;
      }
    } catch (error) {
      console.error(error);
    }

    time = Math.min(timeout, time * 2);
  } while (Date.now() - startedAt < timeout);
  throw new Error(`Did not recevies any diagnostics after ${timeout}ms.`);
}

export function resetVSCodeFolder() {
  Fs.writeFileSync(getFile('folder/.vscode/settings.json'), '{}');
}
