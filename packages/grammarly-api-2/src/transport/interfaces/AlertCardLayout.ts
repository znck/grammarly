import { PredictionType } from '../enums/PredictionType'

export interface AlertCardLayout {
  category: string
  group: string
  groupDescription: string
  rank: number
  outcome: string
  outcomeDescription: string
  prediction?: PredictionType
  userMuteCategory?: string
  userMuteCategoryDescription?: string
}
