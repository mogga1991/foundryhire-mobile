import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { rateLimit, RateLimitPresets, getUserIdentifier } from '@/lib/rate-limit'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const logger = createLogger('api:auth:profile')

async function _PUT(request: NextRequest) {
  try {
    const authUser = await requireAuth()

    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.standard,
      identifier: () => getUserIdentifier(authUser.id),
    })
    if (rateLimitResult) return rateLimitResult

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    await db
      .update(users)
      .set({ name: name.trim(), updatedAt: new Date() })
      .where(eq(users.id, authUser.id))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error({ message: 'Failed to update profile', error })
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}

export const PUT = withApiMiddleware(_PUT, { csrfProtection: true })
