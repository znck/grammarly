import Parser from 'web-tree-sitter'
import { LanguageName } from '../interfaces/LanguageName'
import { html } from './LanguageHTML'
import { markdown } from './LanguageMarkdown'

const parsers = new Map<LanguageName, Parser>()
const parsersPending = new Map<LanguageName, Promise<Parser>>()

export async function createParser(language: LanguageName): Promise<Parser> {
  const previous = parsers.get(language)
  if (previous != null) return previous
  const parser = createParserInner()
  parsersPending.set(language, parser)

  return await parser

  async function createParserInner() {
    await Parser.init()

    const parser = new Parser()
    parser.setLanguage(await Parser.Language.load(getLanguageFile()))
    parsers.set(language, parser)
    parsersPending.delete(language)

    return parser
  }

  function getLanguageFile(): string | Uint8Array {
    if (typeof process !== 'undefined' && process.versions?.node != null) {
      return require.resolve(`./tree-sitter-${language}.wasm`)
    }

    return `tree-sitter-${language}.wasm`
  }
}

export const transformers = { html, markdown } as const
