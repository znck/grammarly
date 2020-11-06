import { ResponseKind } from '../ResponseKind'
import { BaseResponse } from '../messages/BaseResponse'
import { OutcomeScores } from '../interfaces/OutcomeScores'
import { IdRevision } from '../interfaces/IdRevision'

export interface AsyncCheckFinishedEvent extends BaseResponse {
  action: typeof ResponseKind.ASYNC_CHECK_FINISHED
  rev: IdRevision
  check: 0
  outcomeScores: OutcomeScores
}
