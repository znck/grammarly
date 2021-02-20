import { IdAlert } from '../interfaces/IdAlert'
import { BaseResponse } from '../messages/BaseResponse'
import { ResponseKind } from '../ResponseKind'

export interface RemoveEvent extends BaseResponse {
  id: IdAlert
  action: typeof ResponseKind.REMOVE
  hint?: 'NOT_FIXED'
  mergedIn?: IdAlert
}
