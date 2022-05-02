import type Parser from 'tree-sitter'
import type { RichText, RichTextAttributes } from '@grammarly/sdk'

type SourceMap = Array<[original: number, generated: number, length: number]>

const IGNORED_NODES = new Set([
  'atx_h1_marker',
  'atx_h2_marker',
  'atx_h3_marker',
  'atx_h4_marker',
  'atx_h5_marker',
  'atx_h6_marker',
  'block_quote',
  'code_fence_content',
  'code_span',
  'fenced_code_block',
  'html_atrribute',
  'html_attribute_key',
  'html_attribute_value',
  'html_cdata_section',
  'html_close_tag',
  'html_comment',
  'html_declaration_name',
  'html_declaration',
  'html_open_tag',
  'html_processing_instruction',
  'html_self_closing_tag',
  'html_tag_name',
  'link_destination',
  'link_reference_definition',
  'link_text',
  'list_marker',
  'setext_h1_underline',
  'setext_h2_underline',
  'setext_heading',
  'table_cell',
  'table_column_alignment',
  'table_data_row',
  'table_delimiter_row',
  'table_header_row',
  'table',
  'task_list_item_marker',
])
const OTHER_NODES = new Set([
  'backslash_escape',
  'character_reference',
  'email_autolink',
  'emphasis',
  'hard_line_break',
  'heading_content',
  'image',
  'info_string',
  'line_break',
  'link_label',
  'link_title',
  'link',
  'loose_list',
  'soft_line_break',
  'strikethrough',
  'strong_emphasis',
  'text',
  'uri_autolink',
  'virtual_space',
  'www_autolink',
])

const BLOCK_NODES = new Set([
  'document',
  'atx_heading',
  'task_list_item',
  'html_block',
  'image_description',
  'indented_code_block',
  'list_item',
  'paragraph',
  'thematic_break',
  'tight_list',
])

export function encode(tree: Parser.Tree): [RichText, SourceMap] {
  let offset = 0
  let attributes: RichTextAttributes = {}
  const richtext: RichText = { ops: [] }
  const sourcemap: SourceMap = []
  processNode(tree.rootNode)
  return [richtext, sourcemap]

  function insert(text: string, node?: Parser.SyntaxNode): void {
    richtext.ops.push({ insert: text, attributes: text === '\n' ? pickBlockAttributes() : pickInlineAttributes() })
    if (node != null) sourcemap.push([node.startIndex, offset, text.length])
    else if (sourcemap.length > 0) {
      const last = sourcemap[sourcemap.length - 1]
      sourcemap.push([last[0] + last[2], offset, 0])
    } else {
      sourcemap.push([0, offset, 0])
    }
    offset += text.length
  }

  function processNode(node: Parser.SyntaxNode): void {
    if (IGNORED_NODES.has(node.type)) {
      return // stop processing sub-tree
    } else if (node.type === 'text') {
      insert(node.text, node)
    } else if (node.type === 'line_break' || node.type === 'hard_line_break') {
      insert('\n', node)
    } else if (node.type === 'soft_line_break') {
      insert(' ', node)
    }

    const previousAttributes = attributes
    attributes = { ...previousAttributes, ...getAttributesFor(node) }
    node.children.forEach(processNode)
    if (BLOCK_NODES.has(node.type) && !hasTrailingNewline()) {
      insert('\n')
    }
    attributes = previousAttributes
  }

  function hasTrailingNewline(): boolean {
    return richtext.ops.length > 0 && String(richtext.ops[richtext.ops.length - 1].insert).endsWith('\n')
  }

  function getAttributesFor(node: Parser.SyntaxNode): RichTextAttributes {
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
  }

  function pickBlockAttributes(): RichTextAttributes {
    const picked: RichTextAttributes = {}

    for (const key of ['header', 'list', 'indent'] as const) {
      if (key in attributes) {
        picked[key] = attributes[key] as any
      }
    }

    return picked
  }

  function pickInlineAttributes(): RichTextAttributes {
    const picked: RichTextAttributes = {}

    for (const key of ['bold', 'italic', 'underline', 'code', 'link'] as const) {
      if (key in attributes) {
        picked[key] = attributes[key] as any
      }
    }

    return picked
  }
}

export function decode(text: RichText): string {
  return text.ops
    .map((op) => {
      if (typeof op.insert !== 'string') return ''
      return toMarkdown(op.insert, op.attributes)
    })
    .join('')
}

function toMarkdown(text: string, attributes?: RichTextAttributes): string {
  if (attributes == null) return text
  if (attributes.bold) return `**${text}**`
  if (attributes.italic) return `_${text}_`
  if (attributes.code) return '`' + text + '`'
  if (attributes.link) return `[${text}](${attributes.link})`
  return text
}
