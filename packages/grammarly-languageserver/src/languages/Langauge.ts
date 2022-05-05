import { RichText, RichTextAttributes } from '@grammarly/sdk'
import Parser from 'web-tree-sitter'
import { SourceMap } from '../interfaces/SourceMap'
import { Transformer } from '../interfaces/Transformer'

export function createTransformer(options: {
  isBlockNode(node: Parser.SyntaxNode): boolean
  shouldIgnoreSubtree(node: Parser.SyntaxNode): boolean
  getAttributesFor(node: Parser.SyntaxNode): RichTextAttributes
  processNode(node: Parser.SyntaxNode, insert: (text: string, node?: Parser.SyntaxNode) => void): void
  stringify(content: string, attributes: RichTextAttributes): string
}): Transformer {
  return { encode, decode }

  function encode(tree: Parser.Tree): [RichText, SourceMap] {
    let offset = 0
    let attributes: RichTextAttributes = {}
    const richtext: RichText = { ops: [] }
    const sourcemap: SourceMap = []
    processNode(tree.rootNode)
    return [richtext, sourcemap]

    function processNode(node: Parser.SyntaxNode): void {
      if (options.shouldIgnoreSubtree(node)) return // stop processing sub-tree
      const previousAttributes = attributes
      attributes = { ...previousAttributes, ...options.getAttributesFor(node) }
      options.processNode(node, insert)
      node.children.forEach(processNode)
      if (options.isBlockNode(node) && !hasTrailingNewline()) insert('\n')
      attributes = previousAttributes
    }

    function insert(text: string, node?: Parser.SyntaxNode): void {
      richtext.ops.push({
        insert: text,
        attributes: text === '\n' ? pickBlockAttributes(attributes) : pickInlineAttributes(attributes),
      })
      if (node != null) sourcemap.push([node.startIndex, offset, text.length])
      else if (sourcemap.length > 0) {
        const last = sourcemap[sourcemap.length - 1]
        sourcemap.push([last[0] + last[2], offset, 0])
      } else {
        sourcemap.push([0, offset, 0])
      }
      offset += text.length
    }

    function hasTrailingNewline(): boolean {
      return richtext.ops.length > 0 && String(richtext.ops[richtext.ops.length - 1].insert).endsWith('\n')
    }
  }

  function decode(text: RichText): string {
    return text.ops
      .map((op) => {
        if (typeof op.insert !== 'string') return ''
        if (op.attributes == null) return op.insert
        return options.stringify(op.insert, op.attributes)
      })
      .join('')
  }
}

function pickBlockAttributes(attributes: RichTextAttributes): RichTextAttributes {
  const picked: RichTextAttributes = {}

  for (const key of ['header', 'list', 'indent'] as const) {
    if (key in attributes) {
      // @ts-expect-error
      picked[key] = attributes[key]
    }
  }

  return picked
}

function pickInlineAttributes(attributes: RichTextAttributes): RichTextAttributes {
  const picked: RichTextAttributes = {}

  for (const key of ['bold', 'italic', 'underline', 'code', 'link'] as const) {
    if (key in attributes) {
      // @ts-expect-error
      picked[key] = attributes[key]
    }
  }

  return picked
}
