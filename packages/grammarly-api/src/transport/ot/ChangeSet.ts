import QuillDelta from 'quill-delta'
import { Delta } from './Delta'
import { Op } from './Op'

export class ChangeSet {
  private prev = new QuillDelta()
  private next = new QuillDelta()
  private delta: QuillDelta

  constructor (prevText: string, nextText: string) {
    this.prev.insert(prevText)
    this.next.insert(nextText)
    this.delta = this.prev.diff(this.next)
  }

  diff(): Delta[] {
    return [{ ops: this.delta.ops as Op[] }]
  }

  reposition(offset: number): number {
    return this.delta.transformPosition(offset)
  }
}
