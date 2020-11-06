import { RequestKind } from '../RequestKind'
import { BaseRequest } from './BaseRequest'

export interface SynonymsRequest extends BaseRequest {
  action: typeof RequestKind.SYNONYMS
  begin: number
  token: string
}
