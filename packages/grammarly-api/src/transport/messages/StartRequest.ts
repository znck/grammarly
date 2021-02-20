import { DialectType } from '../enums/DialectType'
import { FeatureType } from '../enums/FeatureType'
import { DocumentContext } from '../interfaces/DocumentContext'
import { RequestKind } from '../RequestKind'
import { BaseRequest } from './BaseRequest'

export interface StartRequest extends BaseRequest {
  action: typeof RequestKind.START
  client: string
  clientSubtype: string
  clientVersion: string
  dialect: DialectType
  docid: string
  documentContext?: DocumentContext
  clientSupports?: FeatureType[]
}
