import { DocumentContext } from '../interfaces/DocumentContext'
import { IdRevision } from '../interfaces/IdRevision'
import { RequestKind } from '../RequestKind'
import { BaseRequest } from './BaseRequest'

export interface SetContextRequest extends BaseRequest {
  action: typeof RequestKind.SET_CONTEXT
  rev: IdRevision
  documentContext: DocumentContext
}
