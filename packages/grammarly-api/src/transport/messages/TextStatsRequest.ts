import { RequestKind } from '../RequestKind'
import { BaseRequest } from './BaseRequest'

export interface TextStatsRequest extends BaseRequest {
  action: typeof RequestKind.TEXT_STATS
}
