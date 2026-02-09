import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'

const logger = createLogger('rate-limit')

// Simple in-memory rate limiter for development/fallback
class InMemoryRateLimiter {
  private cache: Map<string, { count: number; resetAt: number }> = new Map()

  async limit(identifier: string, limit: number, window: number) {
    const now = Date.now()
    const key = identifier
    const existing = this.cache.get(key)

    // Clean up expired entries
    if (existing && existing.resetAt < now) {
      this.cache.delete(key)
    }

    const current = this.cache.get(key)

    if (!current) {
      this.cache.set(key, { count: 1, resetAt: now + window })
      return { success: true, remaining: limit - 1, reset: now + window }
    }

    if (current.count >= limit) {
      return { success: false, remaining: 0, reset: current.resetAt }
    }

    current.count++
    this.cache.set(key, current)
    return { success: true, remaining: limit - current.count, reset: current.resetAt }
  }
}

// Initialize rate limiter based on environment
let rateLimiter: Ratelimit | InMemoryRateLimiter

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  // Production: Use Upstash Redis
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })

  rateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '10 s'), // 10 requests per 10 seconds
    analytics: true,
    prefix: '@talentforge/ratelimit',
  })
  logger.info('Rate limiter initialized with Redis')
} else {
  // Development: Use in-memory fallback
  rateLimiter = new InMemoryRateLimiter()
  logger.warn('Rate limiter initialized with in-memory store (development mode)')
}

export interface RateLimitConfig {
  limit?: number // requests per window
  window?: number // window in milliseconds
  identifier?: (req: NextRequest) => string // function to get identifier
}

export async function rateLimit(
  req: NextRequest,
  config?: RateLimitConfig
): Promise<NextResponse | null> {
  const {
    limit = 10,
    window = 10000, // 10 seconds
    identifier = getDefaultIdentifier,
  } = config || {}

  try {
    const id = identifier(req)

    let result

    if (rateLimiter instanceof Ratelimit) {
      // Upstash rate limiter
      result = await rateLimiter.limit(id)
    } else {
      // In-memory rate limiter
      result = await rateLimiter.limit(id, limit, window)
    }

    if (!result.success) {
      logger.warn({ identifier: id, limit, window }, 'Rate limit exceeded')
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.reset.toString(),
            'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    // Rate limit passed - no response needed
    return null
  } catch (error) {
    // Don't block requests if rate limiting fails
    logger.error({ error }, 'Rate limit check failed')
    return null
  }
}

function getDefaultIdentifier(req: NextRequest): string {
  // Try to get user identifier from various sources
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip')

  // Use IP as fallback identifier
  return ip || 'anonymous'
}

// Helper for user-based rate limiting
export function getUserIdentifier(userId: string) {
  return `user:${userId}`
}

// Helper for IP-based rate limiting
export function getIpIdentifier(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip')
  return `ip:${ip || 'unknown'}`
}

// Helper for endpoint-specific rate limiting
export function getEndpointIdentifier(req: NextRequest, endpoint: string) {
  const ip = getIpIdentifier(req)
  return `${ip}:${endpoint}`
}

// Preset rate limit configurations
export const RateLimitPresets = {
  // Strict: For sensitive operations (auth, payment)
  strict: { limit: 5, window: 60000 }, // 5 requests per minute

  // Standard: For regular API calls
  standard: { limit: 30, window: 60000 }, // 30 requests per minute

  // Relaxed: For read-heavy operations
  relaxed: { limit: 100, window: 60000 }, // 100 requests per minute

  // AI operations: Expensive operations
  ai: { limit: 10, window: 300000 }, // 10 requests per 5 minutes
}
