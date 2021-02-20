import { ResponseKind } from '../ResponseKind'
import { BaseAckResponse } from './BaseAckResponse'

export interface PingResponse extends BaseAckResponse {
  action: typeof ResponseKind.PING
}
