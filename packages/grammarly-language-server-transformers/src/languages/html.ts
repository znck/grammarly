import type Parser from 'tree-sitter'
import type { RichText } from '@grammarly/sdk'

type SourceMap = Array<[original: number, generated: number, length: number]>

const IGNORED_NODES = new Set([
  "'",
  '/>',
  '"',
  '<',
  '<!',
  '</',
  '=',
  '>',
  'attribute',
  'attribute_name',
  'attribute_value',
  'comment',
  'doctype',
  'end_tag',
  'erroneous_end_tag',
  'erroneous_end_tag_name',
  'fragment',
  'quoted_attribute_value',
  'raw_text',
  'script_element',
  'self_closing_tag',
  'start_tag',
  'style_element',
  'tag_name',
])
const OTHER_NODES = new Set(['text'])
const BLOCK_NODES = new Set(['element'])

export function encode(tree: Parser.Tree): [RichText, SourceMap] {
  let len = 0
  const richtext: RichText = { ops: [] }
  const sourcemap: SourceMap = []
  processNode(tree.rootNode)
  return [richtext, sourcemap]

  function processNode(node: Parser.SyntaxNode): void {
    if (IGNORED_NODES.has(node.type)) {
      return // stop processing sub-tree
    } else if (node.type === 'text') {
      const text = node.text
      richtext.ops.push({ insert: text })
      sourcemap.push([node.startIndex, len, text.length])
      len += text.length
      if (
        node.parent != null &&
        richtext.ops.length > 0 &&
        node.parent.lastChild === node &&
        isBlockNode(node.parent) &&
        !String(richtext.ops[richtext.ops.length - 1].insert).endsWith('\n')
      ) {
        richtext.ops.push({ insert: '\n' })
        sourcemap.push([node.endIndex, len, 0])
        len += 1
      }
    } else if (BLOCK_NODES.has(node.type)) {
      node.children.forEach(processNode)
      if (isBlockNode(node)) {
        richtext.ops.push({ insert: '\n' })
        sourcemap.push([node.startIndex, len, 1])
        len += 1
      }
    }
  }
}

const BLOCK_ELEMENTS = new Set([
  'TABLE',
  'DIV',
  'P',
  'BLOCKQUOTE',
  'BODY',
  'PRE',
  'TR',
  'TH',
  'TD',
  'OL',
  'UL',
  'LI',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BR',
  'HR',
])

function isBlockNode(node: Parser.SyntaxNode): boolean {
  if (node.type !== 'element') return false
  const tag = node.children.find((node) => node.type === 'tag_name')
  if (tag == null) return true
  return BLOCK_ELEMENTS.has(tag.text.toUpperCase())
}

export function decode(text: RichText): string {
  return text.ops
    .map((op) => {
      if (typeof op.insert !== 'string') return ''
      return op.insert
    })
    .join('')
}
