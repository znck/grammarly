import { ResponseKind } from '../ResponseKind'
import { BaseResponse } from '../messages/BaseResponse'
import { AlertExtraProperties } from '../interfaces/AlertExtraProperties'
import { Transform } from '../ot/Transform'
import { AlertMutedByType } from '../enums/AlertMutedByType'
import { IdRevision } from '../interfaces/IdRevision'

export interface AlertsChangedEvent extends BaseResponse {
  action: typeof ResponseKind.ALERT_CHANGES
  extra_properties?: AlertExtraProperties
  rev: IdRevision
  transformJson?: Transform
  muted?: AlertMutedByType
}
