import Parser from 'web-tree-sitter'
import { LanguageName } from './LanguageName'

export { transformers } from './languages'
const languages = { html: 'tree-sitter-html.wasm', markdown: 'tree-sitter-markdown.wasm' }
export async function createParser(language: LanguageName): Promise<Parser> {
  await Parser.init()
  const parser = new Parser()
  const Language = await Parser.Language.load(languages[language])
  parser.setLanguage(Language)
  return parser
}
