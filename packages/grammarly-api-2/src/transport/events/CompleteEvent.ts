import { IdRevision } from '../interfaces/IdRevision'
import { ResponseKind } from '../ResponseKind'
import { BaseResponse } from '../messages/BaseResponse'

export interface CompleteEvent extends BaseResponse {
  action: typeof ResponseKind.COMPLETE
  completions: Array<{
    text: string
    patternName: string
    prefixBegin: number
    prefixEnd: number
    textBegin: number
    textEnd: number
    confidence: number
    confidenceCurve: Readonly<Record<number, number>>
  }>
  threshold: number
  rev: IdRevision
}
