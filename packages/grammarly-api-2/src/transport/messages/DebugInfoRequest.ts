import { RequestKind } from '../RequestKind'
import { BaseRequest } from './BaseRequest'

export interface DebugInfoRequest extends BaseRequest {
  action: typeof RequestKind.DEBUG_INFO
}
