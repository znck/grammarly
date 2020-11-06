import { RequestKindType } from '../RequestKind'

export interface BaseRequest {
  id: number
  action: RequestKindType
}
