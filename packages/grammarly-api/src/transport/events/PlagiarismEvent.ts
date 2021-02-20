import { ResponseKind } from '../ResponseKind'
import { BaseResponse } from '../messages/BaseResponse'

export interface PlagiarismEvent extends BaseResponse {
  action: typeof ResponseKind.PLAGIARISM
}
