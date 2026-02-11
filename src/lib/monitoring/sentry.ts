import { createLogger } from '@/lib/logger'

const logger = createLogger('sentry')

export interface ErrorContext {
  userId?: string
  companyId?: string
  requestId?: string
  component?: string
  action?: string
  metadata?: Record<string, unknown>
}

// Cache the Sentry module so we only attempt one dynamic import
// @ts-ignore - Sentry is an optional dependency
let sentryModule: typeof import('@sentry/nextjs') | null | undefined = undefined

/**
 * Attempt to load @sentry/nextjs dynamically.
 * Returns null if the package is not installed (graceful degradation).
 */
// @ts-ignore - Sentry is an optional dependency
async function getSentry(): Promise<typeof import('@sentry/nextjs') | null> {
  if (sentryModule !== undefined) {
    return sentryModule
  }
  try {
    // @ts-ignore - Sentry is an optional dependency
    sentryModule = await import('@sentry/nextjs')
    return sentryModule
  } catch {
    sentryModule = null
    return null
  }
}

/**
 * Initialize Sentry (call once at app startup).
 * If @sentry/nextjs is not installed, this is a no-op.
 */
export async function initSentry(): Promise<void> {
  const Sentry = await getSentry()
  if (!Sentry) {
    logger.info({ message: 'Sentry not available, using structured logging only' })
    return
  }

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) {
    logger.warn({ message: 'NEXT_PUBLIC_SENTRY_DSN not set, Sentry disabled' })
    return
  }

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
  })

  logger.info({ message: 'Sentry initialized successfully' })
}

/**
 * Capture an error with context.
 * If Sentry is not available, falls back to structured logging.
 */
export function captureError(error: Error | unknown, context?: ErrorContext): void {
  const errorObj = error instanceof Error ? error : new Error(String(error))

  // Always log with structured logger
  logger.error({
    message: 'Error captured',
    error: errorObj.message,
    stack: errorObj.stack,
    ...context,
  })

  // Attempt to send to Sentry (non-blocking)
  getSentry()
    .then((Sentry) => {
      if (!Sentry) return

      Sentry.withScope((scope: any) => {
        if (context?.userId) scope.setTag('userId', context.userId)
        if (context?.companyId) scope.setTag('companyId', context.companyId)
        if (context?.requestId) scope.setTag('requestId', context.requestId)
        if (context?.component) scope.setTag('component', context.component)
        if (context?.action) scope.setTag('action', context.action)
        if (context?.metadata) scope.setExtras(context.metadata)

        Sentry.captureException(errorObj)
      })
    })
    .catch(() => {
      // Sentry send failed; already logged above
    })
}

/**
 * Capture a message (non-error event).
 * Falls back to structured logging if Sentry is not available.
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error',
  context?: ErrorContext
): void {
  // Always log with structured logger
  const logLevel = level === 'warning' ? 'warn' : level
  logger[logLevel]({
    message,
    ...context,
  })

  // Attempt to send to Sentry
  getSentry()
    .then((Sentry) => {
      if (!Sentry) return

      Sentry.withScope((scope: any) => {
        if (context?.userId) scope.setTag('userId', context.userId)
        if (context?.companyId) scope.setTag('companyId', context.companyId)
        if (context?.requestId) scope.setTag('requestId', context.requestId)
        if (context?.component) scope.setTag('component', context.component)
        if (context?.action) scope.setTag('action', context.action)
        if (context?.metadata) scope.setExtras(context.metadata)

        Sentry.captureMessage(message, level)
      })
    })
    .catch(() => {
      // Sentry send failed; already logged
    })
}

/**
 * Set user context for Sentry scope.
 * No-op if Sentry is not available.
 */
export function setUserContext(userId: string, email?: string, companyId?: string): void {
  getSentry()
    .then((Sentry) => {
      if (!Sentry) return

      Sentry.setUser({
        id: userId,
        email: email || undefined,
      })

      if (companyId) {
        Sentry.setTag('companyId', companyId)
      }
    })
    .catch(() => {
      // Sentry not available
    })
}

/**
 * Create a performance transaction.
 * Returns a no-op object if Sentry is not available.
 */
export function startTransaction(
  name: string,
  op: string
): { finish: () => void } {
  const startTime = Date.now()

  return {
    finish: () => {
      const durationMs = Date.now() - startTime
      logger.info({
        message: 'Transaction completed',
        transaction: name,
        operation: op,
        durationMs,
      })
    },
  }
}
