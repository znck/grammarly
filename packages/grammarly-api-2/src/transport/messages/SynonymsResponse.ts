import { SynonymsGroup } from '../interfaces/SynonymsGroup'
import { ResponseKind } from '../ResponseKind'
import { BaseAckResponse } from './BaseAckResponse'

export interface SynonymsResponse extends BaseAckResponse {
  action: typeof ResponseKind.SYNONYMS
  token: string
  synonyms: { pos: number; meanings: SynonymsGroup[] }
}
