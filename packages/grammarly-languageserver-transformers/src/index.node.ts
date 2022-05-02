import Parser from 'tree-sitter'
import html from 'tree-sitter-html'
import markdown from 'tree-sitter-markdown'
import { LanguageName } from './LanguageName'

export { transformers } from './languages'
const languages = { html, markdown }
export async function createParser(language: LanguageName): Promise<Parser> {
  const parser = new Parser()

  parser.setLanguage(languages[language])

  return parser
}
