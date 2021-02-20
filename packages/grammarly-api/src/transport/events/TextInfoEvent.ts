import { ResponseKind } from '../ResponseKind'
import { BaseResponse } from '../messages/BaseResponse'

export interface TextInfoEvent extends BaseResponse {
  action: typeof ResponseKind.TEXT_INFO
  wordsCount: number
  charsCount: number
  readabilityScore: number
  messages?: {
    assistantHeader: string
  }
}
