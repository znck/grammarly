import { Emotion } from '../interfaces/Emotion'
import { ResponseKind } from '../ResponseKind'
import { BaseResponse } from '../messages/BaseResponse'

export interface EmotionsEvent extends BaseResponse {
  action: typeof ResponseKind.EMOTIONS
  emotions: Emotion[]
}
