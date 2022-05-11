import Parser from 'web-tree-sitter'
import { html } from './LanguageHTML'
import { markdown } from './LanguageMarkdown'

export type { SourceMap, Transformer } from './Language'

const parsers = new Map<string, Parser>()
const parsersPending = new Map<string, Promise<Parser>>()

export async function createParser(language: string): Promise<Parser> {
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
      if (process.env.NODE_ENV === 'test') {
        return require.resolve(`../dist/tree-sitter-${language}.wasm`)
      }
      return require.resolve(`./tree-sitter-${language}.wasm`)
    }

    return `tree-sitter-${language}.wasm`
  }
}

export const transformers = { html, markdown } as const
