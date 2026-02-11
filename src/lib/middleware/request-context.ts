import crypto from 'crypto'

export interface RequestContext {
  requestId: string
  userId?: string
  companyId?: string
  path: string
  method: string
  startTime: number
  ip: string
}

/**
 * Generate a unique request ID using crypto.randomUUID()
 */
export function generateRequestId(): string {
  return crypto.randomUUID()
}

/**
 * Extract request context for logging and tracing.
 * Returns a partial RequestContext (userId/companyId added later after auth).
 */
export function extractRequestContext(request: Request): Partial<RequestContext> {
  return {
    requestId: generateRequestId(),
    path: new URL(request.url).pathname,
    method: request.method,
    startTime: Date.now(),
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
  }
}
