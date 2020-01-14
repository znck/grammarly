import { LANGUAGES } from '@/client/options'
import minimatch from 'minimatch'
import { TextDocument, workspace } from 'vscode'

export function isIgnoredDocument(document: TextDocument) {
  const uri = document.uri.toString()
  const ignore = workspace.getConfiguration('grammarly', document.uri).get<string[]>('ignore') || []
  const isIgnored = !LANGUAGES.includes(document.languageId) || ignore.some(pattern => minimatch(uri, pattern))
  return isIgnored
}
