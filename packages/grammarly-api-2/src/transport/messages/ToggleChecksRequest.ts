import { AsyncChecksTypes } from '../enums/AsyncChecksTypes'
import { RequestKind } from '../RequestKind'
import { BaseRequest } from './BaseRequest'

export interface ToggleChecksRequest extends BaseRequest {
  action: typeof RequestKind.TOGGLE_CHECKS
  checks: Record<AsyncChecksTypes, boolean>
}
