import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { companies, companyUsers, subscriptions, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('POST /api/onboarding error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
