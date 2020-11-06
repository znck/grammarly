import { HeatmapRange } from '../interfaces/HeatmapRange'
import { IdHeatmap } from '../interfaces/IdHeatmap'
import { IdRevision } from '../interfaces/IdRevision'
import { ResponseKind } from '../ResponseKind'
import { BaseResponse } from '../messages/BaseResponse'

export interface HeatmapEvent extends BaseResponse {
  action: typeof ResponseKind.HEATMAP
  add: HeatmapRange[]
  update: HeatmapRange[]
  remove: IdHeatmap[]
  rev: IdRevision
  originalRev: IdRevision
  version: number
}
