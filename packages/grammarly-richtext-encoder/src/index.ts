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
    if (isNodeJS()) {
      const fetch = globalThis.fetch
      try {
        // @ts-ignore
        globalThis.fetch = null
        await Parser.init()
      } catch (e) {
        console.log('Error in TreeSitter parser:', e)
        throw e
      } finally {
        globalThis.fetch = fetch
      }
    } else {
      await Parser.init()
    }

    try {
      const parser = new Parser()
      parser.setLanguage(await Parser.Language.load(getLanguageFile()))
      parsers.set(language, parser)
      parsersPending.delete(language)
      return parser
    } catch (e) {
      console.log(`Error in TreeSitter ${language} parser:`, e)
      throw e
    }
  }

  function getLanguageFile(): string | Uint8Array {
    if (isNodeJS()) {
      // @ts-ignore
      if (process.env.NODE_ENV === 'test') {
        // @ts-ignore
        return require.resolve(`../dist/tree-sitter-${language}.wasm`)
      }
      // @ts-ignore
      return require.resolve(`./tree-sitter-${language}.wasm`)
    }

    return `tree-sitter-${language}.wasm`
  }
}

function isNodeJS(): boolean {
  // @ts-ignore - Ignore if process does not exist.
  return typeof process !== 'undefined' && process.versions?.node != null
}

export const transformers = { html, markdown } as const
