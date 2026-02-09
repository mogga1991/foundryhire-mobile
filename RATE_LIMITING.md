# Rate Limiting Guide

## Overview

This project implements API rate limiting to prevent abuse and ensure fair usage across all users. The rate limiting system is built on [@upstash/ratelimit](https://github.com/upstash/ratelimit) with fallback to an in-memory implementation for development.

## Architecture

- **Production**: Uses Upstash Redis for distributed rate limiting across multiple instances
- **Development**: Falls back to in-memory rate limiting when Redis is not configured
- **Sliding Window**: Uses sliding window algorithm for smooth rate limiting

## Configuration

### Environment Variables

For production Redis-based rate limiting, set these environment variables:

```env
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

If these are not set, the system will use in-memory rate limiting (suitable for development only).

## Usage

### Basic Usage

```typescript
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await rateLimit(request, RateLimitPresets.standard)
  if (rateLimitResult) return rateLimitResult

  // Your API logic here
}
```

### Available Presets

The library includes several preset configurations:

```typescript
// Strict: For sensitive operations (auth, payment)
RateLimitPresets.strict // 5 requests per minute

// Standard: For regular API calls
RateLimitPresets.standard // 30 requests per minute

// Relaxed: For read-heavy operations
RateLimitPresets.relaxed // 100 requests per minute

// AI operations: Expensive operations
RateLimitPresets.ai // 10 requests per 5 minutes
```

### Custom Configuration

```typescript
import { rateLimit } from '@/lib/rate-limit'

const rateLimitResult = await rateLimit(request, {
  limit: 20, // requests
  window: 60000, // milliseconds (1 minute)
})
```

### Custom Identifiers

By default, rate limiting uses the client's IP address. You can customize the identifier:

```typescript
import { rateLimit, getEndpointIdentifier, getUserIdentifier } from '@/lib/rate-limit'

// Rate limit by endpoint + IP
const rateLimitResult = await rateLimit(request, {
  ...RateLimitPresets.standard,
  identifier: (req) => getEndpointIdentifier(req, 'api-name'),
})

// Rate limit by user ID (requires authentication)
const { userId } = await requireAuth()
const rateLimitResult = await rateLimit(request, {
  ...RateLimitPresets.standard,
  identifier: () => getUserIdentifier(userId),
})
```

## Implementation Examples

### Authentication Endpoints

```typescript
// src/app/api/auth/login/route.ts
import { rateLimit, RateLimitPresets, getEndpointIdentifier } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Strict rate limiting for login attempts (prevents brute force)
  const rateLimitResult = await rateLimit(request, {
    ...RateLimitPresets.strict,
    identifier: (req) => getEndpointIdentifier(req, 'login'),
  })
  if (rateLimitResult) return rateLimitResult

  // Login logic...
}
```

### AI/Expensive Operations

```typescript
// src/app/api/ai/score-candidate/route.ts
import { rateLimit, RateLimitPresets, getEndpointIdentifier } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // AI-specific rate limiting (more restrictive)
  const rateLimitResult = await rateLimit(request, {
    ...RateLimitPresets.ai,
    identifier: (req) => getEndpointIdentifier(req, 'ai-score'),
  })
  if (rateLimitResult) return rateLimitResult

  // AI scoring logic...
}
```

### Standard API Endpoints

```typescript
// src/app/api/candidates/route.ts
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  // Standard rate limiting for regular API calls
  const rateLimitResult = await rateLimit(request, RateLimitPresets.standard)
  if (rateLimitResult) return rateLimitResult

  // Fetch candidates...
}
```

## Rate Limit Headers

When rate limiting is applied, the following headers are included in responses:

- `X-RateLimit-Limit`: Maximum number of requests allowed
- `X-RateLimit-Remaining`: Number of requests remaining
- `X-RateLimit-Reset`: Timestamp when the rate limit resets
- `Retry-After`: Seconds until the client can retry (only when rate limited)

## Error Response

When rate limited, the API returns:

```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": 45
}
```

HTTP Status: `429 Too Many Requests`

## Best Practices

1. **Apply appropriate presets**: Use `strict` for authentication, `ai` for expensive operations, `standard` for regular APIs

2. **Custom identifiers**: Use endpoint-specific identifiers to prevent one endpoint from affecting others

3. **User-based limiting**: For authenticated endpoints, consider using user ID instead of IP

4. **Monitor logs**: Check rate limit warnings in logs to identify potential abuse

5. **Gradual rollout**: Start with relaxed limits and tighten based on usage patterns

## Routes with Rate Limiting

Currently implemented:

- ✅ `/api/auth/login` - Strict (5 req/min)
- ✅ `/api/ai/score-candidate` - AI (10 req/5min)

To be added:

- `/api/auth/signup` - Strict
- `/api/candidates/*` - Standard
- `/api/jobs/*` - Standard
- `/api/ai/*` - AI
- `/api/email/*` - Standard
- `/api/leads/generate` - AI

## Future Improvements

1. **Analytics**: Track rate limit hits for abuse detection
2. **User tiers**: Different limits based on subscription level
3. **Bypass whitelist**: Allow certain IPs/users to bypass rate limits
4. **Dynamic limits**: Adjust limits based on system load
5. **Notifications**: Alert admins when specific IPs hit rate limits repeatedly
