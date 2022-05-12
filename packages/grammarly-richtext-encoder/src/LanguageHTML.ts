import { RichTextAttributes } from '@grammarly/sdk'
import { createTransformer } from './Language'

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

export const html = createTransformer({
  isBlockNode(node) {
    return BLOCK_NODES.has(node.type)
  },
  shouldIgnoreSubtree(node) {
    return IGNORED_NODES.has(node.type)
  },
  getAttributesFor(node) {
    switch (node.type) {
      case 'strong_emphasis':
        return { bold: true }
      case 'emphasis':
        return { italic: true }
      case 'code_span':
        return { code: true }
      case 'atx_heading':
        if (node.firstChild != null) {
          // atx_h[1-6]_marker
          return { header: parseInt(node.firstChild.type.substring(5, 6), 10) as 1 | 2 | 3 | 4 | 5 | 6 }
        }
        return {}

      default:
        return {}
    }
  },
  stringify(node, content) {
    if (node.type === '#text') {
      if (typeof node.op === 'string') return node.op
      return '\n'
    }

    return toHTML(content, node.value)

    function toHTML(text: string, attributes: RichTextAttributes): string {
      if (attributes.bold) return `<b>${text}</b>`
      if (attributes.italic) return `<i>${text}</i>`
      if (attributes.code) return `<code>${text}</code>`
      if (attributes.linebreak) return `<br />`
      if (attributes.link) return `<a href=${JSON.stringify(attributes.link)}>${text}</a>`
      if (attributes.header) return `<h${attributes.header}>${content}</h${attributes.header}>`

      return text
    }
  },
  processNode(node, insert) {
    if (node.type === 'text') {
      insert(node.text, node)
    }
  },
})
