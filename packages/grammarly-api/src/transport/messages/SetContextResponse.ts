import { IdRevision } from '../interfaces/IdRevision'
import { ResponseKind } from '../ResponseKind'
import { BaseAckResponse } from './BaseAckResponse'

export interface SetContextResponse extends BaseAckResponse {
  action: typeof ResponseKind.SET_CONTEXT
  rev: IdRevision
}
