import { getTransformOffsetFromTextChange, TextChange } from './TextChange'

export interface TextRange {
  start: number
  end: number
}

export function rebaseTextRange(r: TextRange, cs: TextChange[]): TextRange {
  return cs.reduce((a, c) => {
    const o = getTransformOffsetFromTextChange(c)

    return {
      start: c.pos <= a.start ? a.start + o : a.start,
      end: c.pos < a.end ? a.end + o : a.end,
    }
  }, r)
}
