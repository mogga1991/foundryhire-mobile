import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { extractRequestContext } from './request-context'
import { validateCsrfToken } from '@/lib/security/csrf'

const logger = createLogger('api')

type ApiHandler = (request: NextRequest, context?: any) => Promise<NextResponse>

interface ApiMiddlewareOptions {
  csrfProtection?: boolean
}

/**
 * Higher-order function that wraps API route handlers with:
 * - Automatic request ID generation (returned in X-Request-Id response header)
 * - Request/response logging (method, path, status, duration)
 * - Unhandled error catching with structured logging
 * - Content-Type validation for POST/PATCH/PUT requests
 * - Optional CSRF protection
 */
export function withApiMiddleware(
  handler: ApiHandler,
  options: ApiMiddlewareOptions = {}
): ApiHandler {
  return async (request: NextRequest, context?: any) => {
    const reqCtx = extractRequestContext(request)

    // CSRF Protection (if enabled)
    if (options.csrfProtection) {
      const shouldSkipCsrf = shouldSkipCsrfValidation(reqCtx.path || '')

      if (!shouldSkipCsrf) {
        const csrfError = validateCsrfToken(request)
        if (csrfError) {
          logger.warn({
            message: 'CSRF validation failed',
            requestId: reqCtx.requestId,
            method: reqCtx.method,
            path: reqCtx.path,
          })
          csrfError.headers.set('X-Request-Id', reqCtx.requestId!)
          return csrfError
        }
      }
    }

    // Content-Type validation for mutation requests
    if (['POST', 'PATCH', 'PUT'].includes(request.method)) {
      const contentType = request.headers.get('content-type') || ''
      // Allow JSON, form-data (for file uploads), and form-urlencoded
      const isValidContentType =
        contentType.includes('application/json') ||
        contentType.includes('multipart/form-data') ||
        contentType.includes('application/x-www-form-urlencoded')

      if (!isValidContentType && contentType !== '') {
        logger.warn({
          message: 'Invalid Content-Type for mutation request',
          requestId: reqCtx.requestId,
          method: reqCtx.method,
          path: reqCtx.path,
          contentType,
        })
        const response = NextResponse.json(
          { error: 'Unsupported Content-Type', requestId: reqCtx.requestId },
          { status: 415 }
        )
        response.headers.set('X-Request-Id', reqCtx.requestId!)
        return response
      }
    }

    try {
      const response = await handler(request, context)

      // Log request completion
      logger.info({
        message: 'API request completed',
        requestId: reqCtx.requestId,
        method: reqCtx.method,
        path: reqCtx.path,
        status: response.status,
        durationMs: Date.now() - reqCtx.startTime!,
      })

      // Add request ID to response headers
      response.headers.set('X-Request-Id', reqCtx.requestId!)
      return response
    } catch (error) {
      const durationMs = Date.now() - reqCtx.startTime!

      logger.error({
        message: 'Unhandled API error',
        requestId: reqCtx.requestId,
        method: reqCtx.method,
        path: reqCtx.path,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        durationMs,
      })

      // Return standardized error response
      const response = NextResponse.json(
        { error: 'Internal server error', requestId: reqCtx.requestId },
        { status: 500 }
      )
      response.headers.set('X-Request-Id', reqCtx.requestId!)
      return response
    }
  }
}

/**
 * Determine if CSRF validation should be skipped for a given path
 *
 * Skip CSRF for:
 * - Webhook routes (/api/webhooks/*)
 * - Auth routes (/api/auth/*)
 * - Candidate portal routes with Bearer token auth (/api/portal/*)
 * - CSRF token endpoint itself (/api/csrf)
 */
function shouldSkipCsrfValidation(path: string): boolean {
  const skipPatterns = [
    /^\/api\/webhooks\//,
    /^\/api\/auth\//,
    /^\/api\/portal\//,
    /^\/api\/csrf$/,
  ]

  return skipPatterns.some(pattern => pattern.test(path))
}
