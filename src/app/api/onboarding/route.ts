import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { companies, companyUsers, subscriptions, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('api:onboarding')
import { rateLimit, RateLimitPresets, getIpIdentifier } from '@/lib/rate-limit'

async function _POST(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.standard,
      identifier: (req) => getIpIdentifier(req),
    })
    if (rateLimitResult) return rateLimitResult

    const authUser = await requireAuth()

    const body = await request.json()
    const { companyName, industrySector, companySize, role, subscriptionTier } = body

    if (!companyName || !industrySector || !companySize || !role || !subscriptionTier) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Update user name if not already set
    const [dbUser] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1)

    if (dbUser && !dbUser.name && authUser.name) {
      await db
        .update(users)
        .set({ name: authUser.name, updatedAt: new Date() })
        .where(eq(users.id, authUser.id))
    }

    // Create company
    const [company] = await db
      .insert(companies)
      .values({
        name: companyName.trim(),
        industrySector,
        companySize,
      })
      .returning()

    // Link user to company
    await db.insert(companyUsers).values({
      companyId: company.id,
      userId: authUser.id,
      role: role === 'HR Director' ? 'admin' : 'recruiter',
    })

    // Create subscription
    const planLimits: Record<string, { jobPostsLimit: number; aiCreditsLimit: number }> = {
      starter: { jobPostsLimit: 3, aiCreditsLimit: 100 },
      professional: { jobPostsLimit: 10, aiCreditsLimit: 500 },
      enterprise: { jobPostsLimit: 999999, aiCreditsLimit: 999999 },
    }

    const limits = planLimits[subscriptionTier] ?? planLimits.starter

    await db.insert(subscriptions).values({
      companyId: company.id,
      plan: subscriptionTier,
      status: 'active',
      jobPostsLimit: limits.jobPostsLimit,
      aiCreditsLimit: limits.aiCreditsLimit,
    })

    return NextResponse.json({ success: true, companyId: company.id })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error({ message: 'Failed to complete onboarding', error })
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
