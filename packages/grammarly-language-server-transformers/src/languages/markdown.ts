import type Parser from 'tree-sitter'
import type { RichText } from '@grammarly/sdk'

type SourceMap = Array<[original: number, generated: number, length: number]>

export function encode(tree: Parser.Tree): [RichText, SourceMap] {
  let len = 0
  const richtext: RichText = { ops: [] }
  const sourcemap: SourceMap = []
  const bfs = [tree.rootNode]
  while (bfs.length > 0) {
    const currentNode = bfs.shift()
    if (currentNode == null) break
    if (['code_fence_content', 'code_span', 'html_attribute_value', 'indented_code_block'].includes(currentNode.type)) {
    } else if (currentNode.type === 'text') {
      const text = currentNode.text
      richtext.ops.push({ insert: text })
      sourcemap.push([currentNode.startIndex, len, text.length])
      len += text.length
    } else if (currentNode.type === 'line_break' || currentNode.type === 'soft_line_break') {
      richtext.ops.push({ insert: '\n' })
      sourcemap.push([currentNode.startIndex, len, 1])
      len += 1
    } else {
      bfs.unshift(...currentNode.children)
    }
  }

  return [richtext, sourcemap]
}

export function decode(text: RichText): string {
  return text.ops
    .map((op) => {
      if (typeof op.insert !== 'string') return ''
      return op.insert
    })
    .join('')
}
