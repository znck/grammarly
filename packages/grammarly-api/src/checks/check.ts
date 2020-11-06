import { version } from '../../package.json'
import { anonymous, authenticate } from '../auth'
import { GrammarlyClient } from '../GrammarlyClient'
import { DocumentContext } from '../transport/interfaces/DocumentContext'
import { getIdRevision } from '../transport/interfaces/IdRevision'

export interface CheckOptions {
  clientName?: string
  clientVersion?: string
  credentials: { username: string; password: string }
  context?: Partial<DocumentContext>
}
export async function createCheckClient(text: string, options: Partial<CheckOptions>): Promise<GrammarlyClient> {
  return new Promise(async (resolve) => {
    const client = new GrammarlyClient({
      documentId: Buffer.from(text).toString('hex').substr(0, 64),
      clientName: options?.clientName ?? 'generic-check',
      clientType: 'general',
      clientVersion: options?.clientVersion ?? version,
      getToken: async () => {
        const result = await (options?.credentials != null
          ? authenticate(options.credentials.username, options.credentials.password)
          : anonymous())

        return result.token
      },
      onConnection: async () => {
        await client.start({ dialect: options?.context?.dialect ?? 'american' })
        const { rev } = await client.submitOT({
          rev: getIdRevision(0),
          doc_len: 0,
          deltas: [{ ops: [{ insert: text }] }],
          chunked: false,
        })

        if (options?.context != null) {
          await client.setContext({
            rev,
            documentContext: {
              audience: 'knowledgeable',
              dialect: 'american',
              domain: 'general',
              emotions: [],
              goals: [],
              style: 'neutral',
              ...options.context,
            },
          })
        }

        resolve(client)
      },
    })
  })
}
