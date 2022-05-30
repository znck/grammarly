import { InsertOperation, RichText, RichTextAttributes } from '@grammarly/sdk'
import Parser from 'web-tree-sitter'

export type SourceMap = Array<[original: number, generated: number, length: number]>
export interface Transformer {
  encode(tree: Parser.Tree): [RichText, SourceMap]
  decode(text: RichText): string
}

export function createTransformer(options: {
  isBlockNode(node: Parser.SyntaxNode): boolean
  shouldIgnoreSubtree(node: Parser.SyntaxNode): boolean
  getAttributesFor(node: Parser.SyntaxNode, parentAttrs: RichTextAttributes): RichTextAttributes
  processNode(node: Parser.SyntaxNode, insert: (text: string, node?: Parser.SyntaxNode, skip?: number) => void): void
  stringify(node: Decoder.Node, content: string): string
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
      attributes = { ...previousAttributes, ...options.getAttributesFor(node, { ...attributes }) }
      options.processNode(node, insert)
      node.children.forEach(processNode)
      if (options.isBlockNode(node) && !hasTrailingNewline()) insert('\n')
      attributes = previousAttributes
    }

    function insert(text: string, node?: Parser.SyntaxNode, skip: number = 0): void {
      if (text === '') return
      richtext.ops.push({
        insert: text,
        attributes: text === '\n' ? pickBlockAttributes(attributes) : pickInlineAttributes(attributes),
      })
      if (node != null) sourcemap.push([node.startIndex + skip, offset, text.length])
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
    const ops: InsertOperation[] = text.ops.reduce((ops, op) => {
      if (ops.length === 0 || op.insert === '\n') {
        ops.push(op)
      } else {
        const last = ops[ops.length - 1]
        if (
          typeof last.insert === 'string' &&
          typeof op.insert === 'string' &&
          last.insert !== '\n' &&
          sameAttributes(last.attributes, op.attributes)
        ) {
          last.insert += op.insert
        } else {
          ops.push(op)
        }
      }

      return ops
    }, [] as InsertOperation[])
    const root: Decoder.Element = { type: 'block', childNodes: [], attributes: {}, value: {} }

    function findParent(node: Decoder.Element, attributes: RichTextAttributes): Decoder.Element {
      if (node === root) {
        const parent: Decoder.Element = { type: 'inline', attributes, value: attributes, childNodes: [], parent: node }
        root.childNodes.push(parent)
        return parent
      }

      const diff = diffAttributes(node.attributes, attributes)
      if (diff.removed.length == 0 && diff.added.length === 0) return node
      if (diff.removed.length === 0) {
        const value: RichTextAttributes = {}
        diff.added.forEach((key) => {
          value[key] = attributes[key] as any
        })
        const parent: Decoder.Element = { type: 'inline', attributes, value, childNodes: [], parent: node }
        node.childNodes.push(parent)
        return parent
      }

      if (node.parent == null) throw new Error('Unexpected')

      return findParent(node.parent, attributes)
    }

    let current: Decoder.Element = root
    const leaves: Decoder.Text[] = []
    for (let i = 0; i < ops.length; i += 1) {
      const op = ops[i]
      if (op.insert === '\n' && i > 0) {
        let j = i
        for (; j >= 0; --j) {
          if (ops[j - 1]?.insert === '\n') break
        }
        const target = commonAncestor(leaves.find((leave) => leave.op === ops[j])!, leaves[leaves.length - 1])
        const parent = target.parent!
        const node: Decoder.Element = {
          type: 'block',
          attributes: op.attributes ?? {},
          value: op.attributes ?? {},
          childNodes: [target],
          parent: parent,
        }
        const index = parent.childNodes.indexOf(target)
        parent.childNodes.splice(index, 1)
        parent.childNodes.push(node)
        target.parent = node
      } else {
        const node: Decoder.Text = { type: '#text', op }
        leaves.push(node)
        current = findParent(current, op.attributes ?? {})
        current.childNodes.push(node)
      }
    }

    return processNode(root)

    function processNode(node: Decoder.Node): string {
      if (node.type === '#text') return options.stringify(node, '')
      return options.stringify(node, node.childNodes.map((node) => processNode(node)).join(''))
    }
  }
}

function commonAncestor(a: Decoder.Node, b: Decoder.Node): Decoder.Element {
  const pa = pathFromRoot(a)
  const pb = pathFromRoot(b)
  const n = Math.min(pa.length, pb.length)
  for (let i = 0; i < n; ++i) {
    if (pa[i] !== pb[i]) return getEl(pa[i - 1])
  }

  throw new Error('No commont ancestor')

  function getEl(node: Decoder.Node): Decoder.Element {
    if (node.type === '#text') return node.parent!
    return node
  }
}

function pathFromRoot(node: Decoder.Node): Decoder.Node[] {
  const path: Decoder.Node[] = []
  let current: Decoder.Node | undefined = node
  while (current != null) {
    path.push(current)
    current = current.parent
  }

  return path.reverse()
}

export namespace Decoder {
  interface BaseNode {
    type: string
    parent?: Element
  }

  export interface Text extends BaseNode {
    type: '#text'
    op: InsertOperation
  }

  export interface Element extends BaseNode {
    type: 'block' | 'inline'
    childNodes: Node[]
    attributes: RichTextAttributes
    value: RichTextAttributes
  }

  export type Node = Text | Element
}

function sameAttributes(a?: RichTextAttributes, b?: RichTextAttributes): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (Object.keys(a).length !== Object.keys(b).length) return false

  return (Object.keys(a) as Array<keyof RichTextAttributes>).every((key) => a[key] === b[key])
}

function diffAttributes(
  target?: RichTextAttributes,
  source?: RichTextAttributes,
): { added: Array<keyof RichTextAttributes>; removed: Array<keyof RichTextAttributes> } {
  if (target == null && source == null) return { added: [], removed: [] }
  else if (target == null && source != null) return { added: Object.keys(source) as any, removed: [] }
  else if (target != null && source == null) return { added: [], removed: Object.keys(target) as any }
  else if (target != null && source != null) {
    const added: Array<keyof RichTextAttributes> = []
    const removed: Array<keyof RichTextAttributes> = []

    for (const key of Object.keys(target) as Array<keyof RichTextAttributes>) {
      if (!(key in source)) {
        removed.push(key)
      } else if (source[key] !== target[key]) {
        added.push(key)
        removed.push(key)
      }
    }

    for (const key of Object.keys(source) as Array<keyof RichTextAttributes>) {
      if (!(key in target)) {
        added.push(key)
      }
    }

    return { added, removed }
  }

  return { added: [], removed: [] }
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
