import { ErrorCodeType } from '../enums/ErrorCodeType'
import { ErrorSeverityType } from '../enums/ErrorSeverityType'
import { BaseResponse } from '../messages/BaseResponse'
import { ResponseKind } from '../ResponseKind'

export interface ErrorEvent extends BaseResponse {
  action: typeof ResponseKind.ERROR
  error: ErrorCodeType
  severity: ErrorSeverityType
}
