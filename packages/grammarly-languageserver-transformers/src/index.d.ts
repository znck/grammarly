import Parser from 'tree-sitter'
import { LanguageName } from './LanguageName'
import { SourceMap } from './SourceMap'
import { Transformer } from './Transformer'

export function createParser(languages: LanguageName): Promise<Parser>
export const transformers: Record<LanguageName, Transformer>
export type { Parser, LanguageName, LanguageName, Transformer, SourceMap }
