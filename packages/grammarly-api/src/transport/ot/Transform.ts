import { Delta } from './Delta';
import { Range } from './Range';

export interface Transform {
  highlights: Range[];
  context: Range;
  alternatives: Delta[];
}

export function applyDelta(text: string, change: Delta): string {
  let newText = ''

  change.ops.forEach(op => {
    if ('insert' in op) {
      newText += op.insert
    } else if ('delete' in op) {
      text = text.substr(op.delete)
    } else {
      newText += text.substr(0, op.retain)
      text = text.substr(op.retain)
    }
  })

  return newText + text
}
