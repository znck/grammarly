export interface Transformer {
  encode(tree: Parser.Tree): [RichText, SourceMap]
  decode(text: RichText): string
}
