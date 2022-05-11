import { parseDocument } from 'htmlparser2'
import { ChildNode } from 'domhandler'

export class DOMParser {
  parseFromString(code: string): any {
    const doc = parseDocument(code)

    const body = {
      childNodes: doc.children.map((node) => this._createDomNode(node as any)),
    }

    return { body }
  }

  private _createDomNode(node: ChildNode): any {
    if ('children' in node) {
      if (node.type !== 'tag') return
      return {
        nodeType: node.nodeType,
        nodeName: node.tagName.toUpperCase(),
        childNodes: node.children.map((node) => this._createDomNode(node)),
      }
    } else if ('data' in node) {
      return {
        nodeType: node.nodeType,
        nodeName: '#text',
        textContent: node.data,
      }
    }
  }
}
