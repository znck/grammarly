import { PlagiarismEvent } from '../transport/events/PlagiarismEvent'
import { CheckOptions, createCheckClient } from './check'

export async function checkPlagiarism(text: string, options: CheckOptions): Promise<PlagiarismEvent[]> {
  const alerts: PlagiarismEvent[] = []
  const grammarly = await createCheckClient(text, options)

  await grammarly.toggleChecks({
    checks: {
      plagiarism: true,
    },
  })

  return new Promise((resolve) => {
    grammarly.onPlagiarism((alert) => alerts.push(alert))
    grammarly.onFinished(() => {
      grammarly.dispose()
      resolve(alerts)
    })
  })
}
