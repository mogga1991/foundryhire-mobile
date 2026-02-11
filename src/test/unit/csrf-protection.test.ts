import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

// Mock the dependencies
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/lib/middleware/request-context', () => ({
  extractRequestContext: () => ({
    requestId: 'test-request-id',
    method: 'POST',
    path: '/api/test',
    startTime: Date.now(),
  }),
}))

vi.mock('@/lib/security/csrf', () => ({
  validateCsrfToken: vi.fn(),
}))

describe('CSRF Protection with withApiMiddleware', () => {
  let mockHandler: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockHandler = vi.fn(async () => {
      return NextResponse.json({ success: true }, { status: 200 })
    })
  })

  describe('Handler Wrapping', () => {
    it('should wrap a handler correctly', async () => {
      const wrappedHandler = withApiMiddleware(mockHandler)

      expect(typeof wrappedHandler).toBe('function')
    })

    it('should call the underlying handler when CSRF protection is disabled', async () => {
      const wrappedHandler = withApiMiddleware(mockHandler, { csrfProtection: false })

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      })

      await wrappedHandler(request)

      expect(mockHandler).toHaveBeenCalledWith(request, undefined)
    })

    it('should pass through request and params correctly', async () => {
      const wrappedHandler = withApiMiddleware(mockHandler)

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      })
      const context = { params: { id: '123' } }

      await wrappedHandler(request, context)

      expect(mockHandler).toHaveBeenCalledWith(request, context)
    })
  })

  describe('CSRF Protection Option', () => {
    it('should respect csrfProtection: false option', async () => {
      const { validateCsrfToken } = await import('@/lib/security/csrf')
      const wrappedHandler = withApiMiddleware(mockHandler, { csrfProtection: false })

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      })

      await wrappedHandler(request)

      expect(validateCsrfToken).not.toHaveBeenCalled()
    })

    it('should respect csrfProtection: true option', async () => {
      const { validateCsrfToken } = await import('@/lib/security/csrf')
      vi.mocked(validateCsrfToken).mockReturnValue(null) // Valid CSRF

      const wrappedHandler = withApiMiddleware(mockHandler, { csrfProtection: true })

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      })

      await wrappedHandler(request)

      expect(validateCsrfToken).toHaveBeenCalledWith(request)
    })

    it('should return error response when CSRF validation fails', async () => {
      const { validateCsrfToken } = await import('@/lib/security/csrf')
      const csrfError = NextResponse.json({ error: 'CSRF token invalid' }, { status: 403 })
      vi.mocked(validateCsrfToken).mockReturnValue(csrfError)

      const wrappedHandler = withApiMiddleware(mockHandler, { csrfProtection: true })

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await wrappedHandler(request)

      expect(response.status).toBe(403)
      expect(mockHandler).not.toHaveBeenCalled()
    })

    it('should proceed when CSRF validation passes', async () => {
      const { validateCsrfToken } = await import('@/lib/security/csrf')
      vi.mocked(validateCsrfToken).mockReturnValue(null) // Valid CSRF

      const wrappedHandler = withApiMiddleware(mockHandler, { csrfProtection: true })

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await wrappedHandler(request)

      expect(response.status).toBe(200)
      expect(mockHandler).toHaveBeenCalled()
    })
  })

  describe('Request Headers', () => {
    it('should add X-Request-Id header to successful response', async () => {
      const wrappedHandler = withApiMiddleware(mockHandler)

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await wrappedHandler(request)

      expect(response.headers.get('X-Request-Id')).toBe('test-request-id')
    })

    it('should add X-Request-Id header to error response', async () => {
      const { validateCsrfToken } = await import('@/lib/security/csrf')
      const csrfError = NextResponse.json({ error: 'CSRF token invalid' }, { status: 403 })
      vi.mocked(validateCsrfToken).mockReturnValue(csrfError)

      const wrappedHandler = withApiMiddleware(mockHandler, { csrfProtection: true })

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await wrappedHandler(request)

      expect(response.headers.get('X-Request-Id')).toBe('test-request-id')
    })
  })

  describe('Error Handling', () => {
    it('should catch and handle errors from the handler', async () => {
      const errorHandler = vi.fn(async () => {
        throw new Error('Handler error')
      })

      const wrappedHandler = withApiMiddleware(errorHandler)

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await wrappedHandler(request)

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body).toEqual({
        error: 'Internal server error',
        requestId: 'test-request-id',
      })
    })

    it('should include X-Request-Id header in error response', async () => {
      const errorHandler = vi.fn(async () => {
        throw new Error('Handler error')
      })

      const wrappedHandler = withApiMiddleware(errorHandler)

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await wrappedHandler(request)

      expect(response.headers.get('X-Request-Id')).toBe('test-request-id')
    })
  })
})
