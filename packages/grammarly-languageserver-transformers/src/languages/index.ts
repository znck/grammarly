import { LanguageName } from '../LanguageName'
import { Transformer } from '../Transformer'
import * as html from './html'
import * as markdown from './markdown'

export const transformers: Record<LanguageName, Transformer> = { html, markdown } as const
