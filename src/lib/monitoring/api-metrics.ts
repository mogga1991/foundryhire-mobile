import { createLogger } from '@/lib/logger'

const logger = createLogger('api-metrics')

export interface ApiMetric {
  endpoint: string
  method: string
  statusCode: number
  durationMs: number
  requestId?: string
  userId?: string
  companyId?: string
  error?: string
}

/**
 * Log an API metric with appropriate severity level.
 * 5xx errors log at 'error', 4xx at 'warn', everything else at 'info'.
 */
export function logApiMetric(metric: ApiMetric): void {
  const level = metric.statusCode >= 500 ? 'error' : metric.statusCode >= 400 ? 'warn' : 'info'
  logger[level]({
    message: 'API metric',
    ...metric,
  })
}

/**
 * Track AI operation metrics (Claude API calls, scoring, synthesis, etc.)
 */
export function logAiMetric(params: {
  operation: string
  model: string
  inputTokens?: number
  outputTokens?: number
  durationMs: number
  success: boolean
  error?: string
}): void {
  const level = params.success ? 'info' : 'error'
  logger[level]({
    message: 'AI operation metric',
    ...params,
  })
}
