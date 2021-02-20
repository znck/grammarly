import { IdRevision } from '../interfaces/IdRevision'
import { ResponseKind } from '../ResponseKind'
import { BaseAckResponse } from './BaseAckResponse'

export interface DebugInfoResponse extends BaseAckResponse {
  action: typeof ResponseKind['DEBUG_INFO']
  rev: IdRevision
  sid: number
  text: string
}
