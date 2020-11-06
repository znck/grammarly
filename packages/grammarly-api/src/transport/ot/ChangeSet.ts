import { Delta } from './Delta'
import { Op } from './Op'
import { del, ins, TextChange } from './TextChange'

export class ChangeSet {
  private ops: Op[] = []
  private deltas: Delta[] = []
  private changes: TextChange[] = []

  constructor(private callback: (deltas: Delta[], changes: TextChange[]) => Promise<void>) {}

  insertText(position: number, text: string) {
    if (position) this.ops.push({ retain: position })
    this.ops.push({ insert: text })
    this.changes.push(ins(position, text))

    return this
  }

  deleteText(position: number, length: number) {
    if (position) this.ops.push({ retain: position })
    this.ops.push({ delete: length })
    this.changes.push(del(position, length))

    return this
  }

  setText(text: string) {
    this.ops.push({ insert: text })

    return this
  }

  commit() {
    if (this.ops.length) {
      this.deltas.push({ ops: this.ops })
      this.ops = []
    }

    return this
  }

  apply(): Promise<void> {
    return this.commit().callback(this.deltas, this.changes)
  }
}
