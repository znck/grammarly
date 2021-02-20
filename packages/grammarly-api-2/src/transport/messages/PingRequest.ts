import { RequestKind } from '../RequestKind'
import { BaseRequest } from './BaseRequest'

export interface PingRequest extends BaseRequest {
  action: typeof RequestKind.PING
}
