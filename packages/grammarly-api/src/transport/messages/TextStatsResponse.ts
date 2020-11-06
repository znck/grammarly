import { DocumentStatistics } from '../interfaces/DocumentStatistics'
import { ResponseKind } from '../ResponseKind'
import { BaseAckResponse } from './BaseAckResponse'

export interface TextStatsResponse extends BaseAckResponse, DocumentStatistics {
  action: typeof ResponseKind.TEXT_STATS
}
