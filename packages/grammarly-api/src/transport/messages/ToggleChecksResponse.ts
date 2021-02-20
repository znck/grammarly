import { ResponseKind } from '../ResponseKind'
import { BaseAckResponse } from './BaseAckResponse'

export interface ToggleChecksResponse extends BaseAckResponse {
  action: typeof ResponseKind.TOGGLE_CHECKS
}
