import { DialectType } from '../enums/DialectType'
import { DocumentAudienceType } from '../enums/DocumentAudienceType'
import { DocumentDomainType } from '../enums/DocumentDomainType'
import { DocumentGoalType } from '../enums/DocumentGoalType'
import { WritingEmotionType } from '../enums/WritingEmotionType'
import { WritingStyleType } from '../enums/WritingStyleType'

export interface DocumentContext {
  dialect: DialectType
  domain: DocumentDomainType
  goals: DocumentGoalType[]
  audience?: DocumentAudienceType
  style?: WritingStyleType
  emotions: WritingEmotionType[]
}
