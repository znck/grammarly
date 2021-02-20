import { IdRevision } from '../interfaces/IdRevision'
import { IdTakeaway } from '../interfaces/IdTakeaway'
import { BaseResponse } from '../messages/BaseResponse'
import { ResponseKind } from '../ResponseKind'

type Takeaway = any

export interface TakeawaysEvent extends BaseResponse {
  action: typeof ResponseKind.TAKEAWAYS
  add: Takeaway[]
  update: Takeaway[]
  remove: IdTakeaway[]
  rev: IdRevision
}
