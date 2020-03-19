import { getDocumentSettings, getSettings } from './settings';

export async function isKnownWord(word: string, uri?: string) {
  const settings = await (uri ? getDocumentSettings(uri) : getSettings());

  return (
    settings.userWords.includes(word) ||
    settings.userWords.includes(word.toLocaleLowerCase())
  );
}
