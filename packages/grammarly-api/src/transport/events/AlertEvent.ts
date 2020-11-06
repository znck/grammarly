import { AlertImpactType } from '../enums/AlertImpactType'
import { AlertMutedByType } from '../enums/AlertMutedByType'
import { AlertViewType } from '../enums/AlertViewType'
import { AlertCardLayout } from '../interfaces/AlertCardLayout'
import { AlertExtraProperties } from '../interfaces/AlertExtraProperties'
import { IdAlert } from '../interfaces/IdAlert'
import { IdRevision } from '../interfaces/IdRevision'
import { Transform } from '../ot/Transform'
import { ResponseKind } from '../ResponseKind'
import { BaseResponse } from '../messages/BaseResponse'

export interface AlertEvent extends BaseResponse {
  id: IdAlert
  action: typeof ResponseKind.ALERT
  rev: IdRevision
  begin: number
  end: number
  highlightBegin: number
  highlightEnd: number
  text: string
  pname: string
  point: string
  highlightText: string
  category: string
  categoryHuman: string
  group: string
  title: string
  details: string
  examples: string
  explanation: string
  transforms: string[]
  replacements: string[]
  free: boolean
  extra_properties: AlertExtraProperties
  hidden: boolean
  impact: AlertImpactType
  cardLayout: AlertCardLayout
  sentence_no: number
  todo: string
  minicardTitle: string
  cost?: number
  updatable?: boolean
  transformJson?: Transform
  labels?: string[]
  subalerts?: Array<{
    transformJson: Transform
    highlightText: string
    label: string
  }>
  muted?: AlertMutedByType
  view?: AlertViewType
}
