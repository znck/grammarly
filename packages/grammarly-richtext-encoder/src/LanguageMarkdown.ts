import type { RichTextAttributes } from '@grammarly/sdk'
import { createTransformer } from './Language'

const IGNORED_NODES = new Set([
  'atx_h1_marker',
  'atx_h2_marker',
  'atx_h3_marker',
  'atx_h4_marker',
  'atx_h5_marker',
  'atx_h6_marker',
  'block_quote',
  'code_fence_content',
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
  'list_marker',
  'setext_h1_underline',
  'setext_h2_underline',

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
  'code_span',
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
  'link_text',
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
  'setext_heading',
  'task_list_item',
  'html_block',
  'image_description',
  'indented_code_block',
  'list_item',
  'paragraph',
  'thematic_break',
  'tight_list',
])

export const markdown = createTransformer({
  isBlockNode(node) {
    return BLOCK_NODES.has(node.type)
  },
  shouldIgnoreSubtree(node) {
    return IGNORED_NODES.has(node.type)
  },
  getAttributesFor(node, attributes) {
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
      case 'setext_heading':
        if (node.lastNamedChild != null) {
          // setext_h[1-2]_underline
          return {
            header: parseInt(node.lastNamedChild.type.substring('setext_h'.length, 'setext_h'.length + 1), 10) as 1 | 2,
          }
        }
        return {}
      case 'link':
        if (node.lastNamedChild?.type === 'link_destination') {
          return {
            link: node.lastNamedChild.firstNamedChild?.text ?? '',
          }
        }
        return { link: '' }

      case 'tight_list':
        return {
          list: /[0-9]/.test(node.firstNamedChild?.firstNamedChild?.text ?? '') ? 'number' : 'bullet',
          indent: attributes.indent != null ? attributes.indent + 1 : 1,
        }

      default:
        return {}
    }
  },
  stringify(node, content) {
    if (node.type === '#text') {
      if (typeof node.op.insert === 'string') return node.op.insert
      return '\n'
    }

    return toMarkdown(content, node.value)
  },
  processNode(node, insert) {
    if (node.type === 'text') {
      if (node.parent?.parent?.type === 'atx_heading' && node.parent.firstChild?.equals(node)) {
        insert(node.text.slice(1), node, 1)
      } else if (
        node.parent?.type === 'paragraph' &&
        node.text.startsWith(': ') &&
        node.parent.firstChild?.equals(node)
      ) {
        insert(node.text.slice(2), node, 2) // #255 - Definition Lists
      } else insert(node.text, node)
    } else if (node.type === 'line_break' || node.type === 'hard_line_break') {
      insert('\n', node)
    } else if (node.type === 'soft_line_break') {
      insert(' ', node)
    }
  },
})

function toMarkdown(text: string, attributes?: RichTextAttributes): string {
  if (attributes == null) return text
  if (attributes.bold) return `**${text}**`
  if (attributes.italic) return `_${text}_`
  if (attributes.code) return '`' + text + '`'
  if (attributes.link) return `[${text}](${attributes.link})`
  if (attributes.list && attributes.indent != null)
    return `${'  '.repeat(attributes.indent - 1)}${attributes.list === 'number' ? '1. ' : '- '}${text}\n`
  if (attributes.header) return '#'.repeat(attributes.header) + ' ' + text + '\n'
  if (attributes['code-block']) return '```\n' + text + '\n```\n'
  return text
}
