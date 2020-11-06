import { ResponseKind } from '../ResponseKind'
import { BaseResponse } from '../messages/BaseResponse'

export interface TextMapsEvent extends BaseResponse {
  action: typeof ResponseKind.TEXT_MAPS
  score: number
  generalScore: number
}
