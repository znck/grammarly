import { DialectType } from '../enums/DialectType'
import { IdAlert } from '../interfaces/IdAlert'
import { IdRevision } from '../interfaces/IdRevision'
import { OutcomeScores } from '../interfaces/OutcomeScores'
import { BaseResponse } from '../messages/BaseResponse'
import { ResponseKind } from '../ResponseKind'

export interface FinishedEvent extends BaseResponse {
  action: typeof ResponseKind.FINISHED
  rev: IdRevision
  score: number
  dialect: DialectType
  outcomeScores?: Partial<OutcomeScores>
  generalScore?: number
  removed?: IdAlert[]
}
