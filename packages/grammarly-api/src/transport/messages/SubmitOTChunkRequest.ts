import { IdRevision } from '../interfaces/IdRevision'
import { Delta } from '../ot/Delta'
import { RequestKind } from '../RequestKind'
import { BaseRequest } from './BaseRequest'

export interface SubmitOTChunkRequest extends BaseRequest {
  action: typeof RequestKind.SUBMIT_OT_CHUNK
  rev: IdRevision
  doc_len: number
  deltas: [Delta]
  chunked: false
}
