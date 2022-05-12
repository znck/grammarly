import { Markup, MarkupChild } from '@grammarly/sdk'

function encodeLeadingAndTrailingSpace(text: string): string {
  return text.replace(/^\n+|\n+$/, '').replace(/^[ ]+|[ ]+$/g, (m) => '&nbsp;'.repeat(m.length))
}

export function toMarkdown(markup: Markup): string {
  let indent = 0
  function stringify(node: MarkupChild): string {
    if (typeof node === 'string') return node + '\n'

    const children: MarkupChild[] = []
    node.children.forEach((child) => {
      if (typeof child !== 'string' && ['del', 'em', 'strong'].includes(child.type) && children.length > 0) {
        const last = children[children.length - 1]
        if (typeof last !== 'string' && last.type === child.type) {
          last.children.push(...child.children)
        }
      }

      if (typeof child === 'string') {
        children.push(child)
      } else {
        children.push({ type: child.type, children: child.children.slice() })
      }
    })

    switch (node.type) {
      case 'ul':
        try {
          indent += 2
          return `${processChildren(node.children)}\n`
        } finally {
          indent -= 2
        }
      case 'li':
        return ' '.repeat(indent - 2) + `- ${processChildren(node.children)}\n`
      case 'del':
        return `<span style="color:#F00;">~~${encodeLeadingAndTrailingSpace(processChildren(node.children))}~~</span>\n`
      case 'em':
        return `_${encodeLeadingAndTrailingSpace(processChildren(node.children))}_\n`
      case 'strong':
        return `**${encodeLeadingAndTrailingSpace(processChildren(node.children))}**\n`
      case 'ins':
        return `<span style="color:#0F0;">${processChildren(node.children)}</span>\n`
      default:
        return processChildren(node.children)
    }
  }

  return processChildren(markup)

  function processChildren(nodes: MarkupChild[]): string {
    return nodes.map((node) => stringify(node)).join('')
  }
}
