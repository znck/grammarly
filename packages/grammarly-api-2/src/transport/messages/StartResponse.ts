import { ResponseKind } from '../ResponseKind'
import { BaseAckResponse } from './BaseAckResponse'

export interface StartResponse extends BaseAckResponse {
  action: typeof ResponseKind.START
  sid: number
}
