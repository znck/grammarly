import { ResponseKind } from '../ResponseKind'
import { BaseAckResponse } from './BaseAckResponse'

export interface OptionResponse extends BaseAckResponse {
  action: typeof ResponseKind.OPTION
}
