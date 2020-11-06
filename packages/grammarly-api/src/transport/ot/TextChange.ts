import { TextChangeDelete } from './TextChangeDelete'
import { TextChangeInsert } from './TextChangeInsert'

export type TextChange = TextChangeInsert | TextChangeDelete

export function isIns(x: TextChange): x is TextChangeInsert {
  return x.type === 'INS'
}

export function isDel(x: TextChange): x is TextChangeDelete {
  return x.type === 'DEL'
}

export function ins(pos: number, text: string): TextChangeInsert {
  return {
    type: 'INS',
    pos: pos,
    text: text,
  }
}

export function del(pos: number, length: number): TextChangeDelete {
  return {
    type: 'DEL',
    pos: pos,
    length: length,
  }
}

export function getTransformOffsetFromTextChange(c: TextChange): number {
  if (isIns(c)) return c.text.length
  else if (isDel(c)) return -c.length
  else throw new Error(`Unexpected change: ${c}`)
}

export function applyTextChanges(text: string, changes: TextChange[]): string {
  return changes.reduce((t, c) => {
    if (isIns(c)) {
      return t.slice(0, c.pos) + c.text + t.slice(c.pos)
    } else if (isDel(c)) {
      return t.slice(0, c.pos) + t.slice(c.pos + c.length)
    } else {
      throw new Error(`Unexpected change: ${c}`)
    }
  }, text)
}
