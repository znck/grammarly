import { OptionType } from '../enums/OptionType'
import { RequestKind } from '../RequestKind'
import { BaseRequest } from './BaseRequest'

export interface OptionRequest extends BaseRequest {
  action: typeof RequestKind.OPTION
  name: OptionType
  value: string
}
