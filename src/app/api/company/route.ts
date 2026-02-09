import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { companies, companyUsers, subscriptions, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    // Check if user already has a company
    const [existingCompanyUser] = await db
      .select()
      .from(companyUsers)
      .where(eq(companyUsers.userId, user.id))
      .limit(1)

    if (existingCompanyUser) {
      return NextResponse.json(
        { error: 'You already have a company set up' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, industry_sector, company_size, website } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      )
    }

    // Create company
    const [company] = await db
      .insert(companies)
      .values({
        name: name.trim(),
        industrySector: industry_sector || null,
        companySize: company_size || null,
        website: website || null,
      })
      .returning()

    // Link user to company as admin
    await db.insert(companyUsers).values({
      companyId: company.id,
      userId: user.id,
      role: 'admin',
    })

    // Create a starter subscription
    await db.insert(subscriptions).values({
      companyId: company.id,
      plan: 'starter',
      status: 'active',
      jobPostsLimit: 3,
      aiCreditsLimit: 100,
    })

    return NextResponse.json({ success: true, companyId: company.id })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('POST /api/company error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { companyId, role } = await requireCompanyAccess()

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1)

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Fetch subscription
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, companyId))
      .limit(1)

    // Fetch team members with user info
    const teamMembers = await db
      .select({
        id: companyUsers.id,
        userId: companyUsers.userId,
        role: companyUsers.role,
        createdAt: companyUsers.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(companyUsers)
      .leftJoin(users, eq(companyUsers.userId, users.id))
      .where(eq(companyUsers.companyId, companyId))

    return NextResponse.json({
      company,
      subscription: subscription || null,
      role,
      companyId,
      teamMembers: teamMembers.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        createdAt: m.createdAt,
        email: m.userEmail ?? 'Unknown',
        fullName: m.userName ?? m.userEmail ?? 'Unknown User',
      })),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { companyId } = await requireCompanyAccess()

    const body = await request.json()

    // Whitelist allowed fields
    const updates: Record<string, unknown> = {}
    if ('name' in body) updates.name = body.name
    if ('industrySector' in body) updates.industrySector = body.industrySector
    if ('companySize' in body) updates.companySize = body.companySize
    if ('website' in body) updates.website = body.website

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    updates.updatedAt = new Date()

    const [updated] = await db
      .update(companies)
      .set(updates)
      .where(eq(companies.id, companyId))
      .returning()

    return NextResponse.json({ company: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
