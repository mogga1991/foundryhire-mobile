import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks -- must be set up before importing the module under test
// ---------------------------------------------------------------------------

// Mock Upstash modules to prevent real Redis connections
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: vi.fn().mockImplementation(() => ({
    limit: vi.fn(),
  })),
}))

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// We need to mock next/server's NextRequest and NextResponse
vi.mock('next/server', () => {
  class MockNextResponse {
    body: unknown
    status: number
    headers: Map<string, string>

    constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body
      this.status = init?.status ?? 200
      this.headers = new Map(Object.entries(init?.headers ?? {}))
    }

    static json(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      return new MockNextResponse(body, init)
    }
  }

  return {
    NextRequest: vi.fn(),
    NextResponse: MockNextResponse,
  }
})

// Now import the module under test
// Because the module initializes the rate limiter at the top level based on env vars,
// and we do NOT set UPSTASH_REDIS_REST_URL/TOKEN, it will use InMemoryRateLimiter
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRequest(options?: {
  ip?: string
  forwardedFor?: string
}): { nextUrl: { pathname: string }; headers: { get: (name: string) => string | null } } {
  const headers = new Map<string, string>()
  if (options?.forwardedFor) {
    headers.set('x-forwarded-for', options.forwardedFor)
  }
  if (options?.ip) {
    headers.set('x-real-ip', options.ip)
  }

  return {
    nextUrl: { pathname: '/api/test' },
    headers: {
      get: (name: string) => headers.get(name) ?? null,
    },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('rateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should allow requests under the limit', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = createMockRequest({ ip: '127.0.0.1' }) as any

    // Use a generous limit to ensure the first request passes
    const result = await rateLimit(req, { limit: 100, window: 60000 })

    // null means the request was allowed (no 429 response)
    expect(result).toBeNull()
  })

  it('should block requests that exceed the limit', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = createMockRequest({ ip: '192.168.1.1' }) as any

    // Use a limit of 2 and make 3 requests
    const config = { limit: 2, window: 60000 }

    const result1 = await rateLimit(req, config)
    expect(result1).toBeNull() // Request 1: allowed

    const result2 = await rateLimit(req, config)
    expect(result2).toBeNull() // Request 2: allowed

    const result3 = await rateLimit(req, config)
    expect(result3).not.toBeNull() // Request 3: blocked
    expect(result3?.status).toBe(429)
  })

  it('should return proper 429 response with rate limit headers', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = createMockRequest({ ip: '10.0.0.1' }) as any
    const config = { limit: 1, window: 60000 }

    // First request passes
    await rateLimit(req, config)

    // Second request is rate limited
    const result = await rateLimit(req, config)
    expect(result).not.toBeNull()
    expect(result?.status).toBe(429)

    // Check headers
    expect(result?.headers.get('X-RateLimit-Limit')).toBe('1')
    expect(result?.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(result?.headers.has('X-RateLimit-Reset')).toBe(true)
    expect(result?.headers.has('Retry-After')).toBe(true)
  })

  it('should return 429 response body with error message and retryAfter', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = createMockRequest({ ip: '10.0.0.2' }) as any
    const config = { limit: 1, window: 60000 }

    // Exhaust the limit
    await rateLimit(req, config)

    // Next request should be blocked
    const result = await rateLimit(req, config)
    expect(result).not.toBeNull()

    // The body should be the error JSON
    const body = result?.body as { error: string; retryAfter: number }
    expect(body.error).toBe('Too many requests. Please try again later.')
    expect(typeof body.retryAfter).toBe('number')
    expect(body.retryAfter).toBeGreaterThan(0)
  })

  it('should use x-forwarded-for header as identifier', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req1 = createMockRequest({ forwardedFor: '1.2.3.4' }) as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req2 = createMockRequest({ forwardedFor: '5.6.7.8' }) as any

    const config = { limit: 1, window: 60000 }

    // First IP: first request passes
    const result1 = await rateLimit(req1, config)
    expect(result1).toBeNull()

    // First IP: second request blocked
    const result2 = await rateLimit(req1, config)
    expect(result2).not.toBeNull()
    expect(result2?.status).toBe(429)

    // Second IP: first request still passes (different identifier)
    const result3 = await rateLimit(req2, config)
    expect(result3).toBeNull()
  })

  it('should use a custom identifier function when provided', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = createMockRequest({ ip: '127.0.0.1' }) as any

    const config = {
      limit: 1,
      window: 60000,
      identifier: () => 'custom-user-123',
    }

    const result1 = await rateLimit(req, config)
    expect(result1).toBeNull()

    const result2 = await rateLimit(req, config)
    expect(result2).not.toBeNull()
    expect(result2?.status).toBe(429)
  })

  it('should return null (allow request) if rate limiting fails due to an error', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = createMockRequest({ ip: '127.0.0.1' }) as any

    const config = {
      limit: 10,
      window: 60000,
      identifier: () => {
        throw new Error('Identifier function failed')
      },
    }

    // Should gracefully fail open and allow the request
    const result = await rateLimit(req, config)
    expect(result).toBeNull()
  })

  it('should use default config when no config is provided', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = createMockRequest({ ip: '172.16.0.1' }) as any

    // Default is 10 requests per 10 seconds
    const result = await rateLimit(req)
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Tests: RateLimitPresets
// ---------------------------------------------------------------------------

describe('RateLimitPresets', () => {
  it('should have strict preset with low limit', () => {
    expect(RateLimitPresets.strict.limit).toBe(5)
    expect(RateLimitPresets.strict.window).toBe(60000)
  })

  it('should have standard preset with moderate limit', () => {
    expect(RateLimitPresets.standard.limit).toBe(30)
    expect(RateLimitPresets.standard.window).toBe(60000)
  })

  it('should have relaxed preset with high limit', () => {
    expect(RateLimitPresets.relaxed.limit).toBe(100)
    expect(RateLimitPresets.relaxed.window).toBe(60000)
  })

  it('should have ai preset with low limit and long window', () => {
    expect(RateLimitPresets.ai.limit).toBe(10)
    expect(RateLimitPresets.ai.window).toBe(300000) // 5 minutes
  })
})
