import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { campaigns, campaignSends, campaignFollowUps, jobs } from '@/lib/db/schema'
import { eq, and, desc, count } from 'drizzle-orm'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { rateLimit, getUserIdentifier, RateLimitPresets } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    const { companyId } = await requireCompanyAccess()

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const id = searchParams.get('id')

    // Single campaign fetch by id
    if (id) {
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.id, id), eq(campaigns.companyId, companyId)))
        .limit(1)

      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      }

      // Fetch sends with candidate info
      const sends = await db
        .select()
        .from(campaignSends)
        .where(eq(campaignSends.campaignId, id))

      return NextResponse.json({ campaign: { ...campaign, campaign_sends: sends } })
    }

    if (!jobId) {
      return NextResponse.json({ error: 'jobId query parameter is required' }, { status: 400 })
    }

    // Parse pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '20', 10)))
    const offset = (page - 1) * perPage

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(campaigns)
      .where(and(eq(campaigns.jobId, jobId), eq(campaigns.companyId, companyId)))

    // Get paginated campaigns
    const data = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.jobId, jobId), eq(campaigns.companyId, companyId)))
      .orderBy(desc(campaigns.createdAt))
      .limit(perPage)
      .offset(offset)

    const totalPages = Math.ceil(total / perPage)

    return NextResponse.json({
      campaigns: data,
      pagination: {
        page,
        perPage,
        total,
        totalPages,
      },
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
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

async function _POST(request: NextRequest) {
  try {
    const { user, companyId } = await requireCompanyAccess()

    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.standard,
      identifier: () => getUserIdentifier(user.id),
    })
    if (rateLimitResult) return rateLimitResult

    const body = await request.json()
    const {
      name,
      subject,
      body: emailBody,
      jobId,
      candidateIds,
      campaignType = 'outreach',
      status = 'draft',
      emailAccountId,
      followUps,
    } = body

    if (!name || !subject || !emailBody || !jobId || !candidateIds?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: name, subject, body, jobId, candidateIds' },
        { status: 400 }
      )
    }

    // Verify job belongs to company
    const [job] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)))
      .limit(1)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const [campaign] = await db
      .insert(campaigns)
      .values({
        companyId,
        jobId,
        emailAccountId: emailAccountId || null,
        name,
        subject,
        body: emailBody,
        status,
        campaignType,
        totalRecipients: candidateIds.length,
        createdBy: user.id,
      })
      .returning()

    // Create sends
    const sends = candidateIds.map((candidateId: string) => ({
      campaignId: campaign.id,
      candidateId,
      status: 'pending' as const,
    }))

    await db.insert(campaignSends).values(sends)

    // Store follow-ups if provided
    if (followUps && Array.isArray(followUps) && followUps.length > 0) {
      const followUpValues = followUps.map((fu: { delayDays: number; subject: string; body: string }, idx: number) => ({
        campaignId: campaign.id,
        stepNumber: idx + 1,
        delayDays: fu.delayDays,
        subject: fu.subject,
        body: fu.body,
      }))
      await db.insert(campaignFollowUps).values(followUpValues)
    }

    return NextResponse.json({ campaign }, { status: 201 })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
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

export const POST = withApiMiddleware(_POST, { csrfProtection: true })

export async function PATCH(request: NextRequest) {
  try {
    const { companyId } = await requireCompanyAccess()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 })
    }

    const body = await request.json()

    const [existing] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.companyId, companyId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (body.status !== undefined) updateData.status = body.status
    if (body.name !== undefined) updateData.name = body.name
    if (body.subject !== undefined) updateData.subject = body.subject
    if (body.body !== undefined) updateData.body = body.body
    if (body.scheduledAt !== undefined) updateData.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null

    const [updated] = await db
      .update(campaigns)
      .set(updateData)
      .where(eq(campaigns.id, id))
      .returning()

    return NextResponse.json({ campaign: updated })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
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
