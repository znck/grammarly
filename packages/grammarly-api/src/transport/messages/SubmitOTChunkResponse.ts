import { IdRevision } from '../interfaces/IdRevision'
import { ResponseKind } from '../ResponseKind'
import { BaseAckResponse } from './BaseAckResponse'

export interface SubmitOTChunkResponse extends BaseAckResponse {
  action: typeof ResponseKind.SUBMIT_OT_CHUNK
  rev: IdRevision
}
