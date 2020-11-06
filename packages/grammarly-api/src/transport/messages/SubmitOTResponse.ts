import { IdRevision } from '../interfaces/IdRevision'
import { ResponseKind } from '../ResponseKind'
import { BaseAckResponse } from './BaseAckResponse'

export interface SubmitOTResponse extends BaseAckResponse {
  action: typeof ResponseKind.SUBMIT_OT
  rev: IdRevision
}
