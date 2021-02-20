export const RequestKind = {
  DEBUG_INFO: 'get_debug_info',
  FEEDBACK: 'feedback',
  OPTION: 'option',
  PING: 'ping',
  SET_CONTEXT: 'set_context',
  START: 'start',
  SUBMIT_OT: 'submit_ot',
  SUBMIT_OT_CHUNK: 'submit_ot_chunk',
  SYNONYMS: 'synonyms',
  TEXT_STATS: 'get_text_stats',
  TOGGLE_CHECKS: 'toggle_checks',
} as const
export type RequestKindType = typeof RequestKind[keyof typeof RequestKind]
