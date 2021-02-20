import { Id } from './Id'

export type IdRevision = Id<'Revision'>
export function getIdRevision(rev: number): IdRevision {
  return rev as IdRevision
}
