import { AlertEvent } from '../transport/events/AlertEvent'
import { CheckOptions, createCheckClient } from './check'

export async function checkGrammar(text: string, options?: CheckOptions): Promise<AlertEvent[]> {
  const grammarly = await createCheckClient(text, options ?? {})

  const alerts: AlertEvent[] = []

  grammarly.onAlert((alert) => alerts.push(alert))

  return new Promise((resolve) => {
    grammarly.onFinished(() => {
      grammarly.dispose()
      resolve(alerts)
    })
  })
}
