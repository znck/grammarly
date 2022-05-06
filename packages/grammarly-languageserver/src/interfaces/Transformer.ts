import { RichText } from '@grammarly/sdk'
import Parser from 'web-tree-sitter'
import { SourceMap } from './SourceMap'

export interface Transformer {
  encode(tree: Parser.Tree): [RichText, SourceMap]
  decode(text: RichText): string
}
