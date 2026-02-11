import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { candidates, candidateActivities, candidateReminders } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id } = await params

    const [data] = await db
      .select()
      .from(candidates)
      .where(and(eq(candidates.id, id), eq(candidates.companyId, companyId)))
      .limit(1)

    if (!data) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    return NextResponse.json({ candidate: data })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'No company set up. Please create your company in Settings first.' }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function _PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id } = await params
    const body = await request.json()

    // Check if candidate exists and belongs to this company
    const [existing] = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(and(eq(candidates.id, id), eq(candidates.companyId, companyId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    // Only allow updating specific fields - map snake_case body keys to camelCase schema keys
    const fieldMap: Record<string, keyof typeof candidates.$inferInsert> = {
      first_name: 'firstName',
      last_name: 'lastName',
      email: 'email',
      phone: 'phone',
      linkedin_url: 'linkedinUrl',
      github_url: 'githubUrl',
      portfolio_url: 'portfolioUrl',
      current_title: 'currentTitle',
      current_company: 'currentCompany',
      location: 'location',
      experience_years: 'experienceYears',
      skills: 'skills',
      resume_url: 'resumeUrl',
      resume_text: 'resumeText',
      cover_letter: 'coverLetter',
      source: 'source',
      status: 'status',
      stage: 'stage',
      ai_score: 'aiScore',
      ai_score_breakdown: 'aiScoreBreakdown',
      ai_summary: 'aiSummary',
      notes: 'notes',
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    for (const [bodyKey, schemaKey] of Object.entries(fieldMap)) {
      if (body[bodyKey] !== undefined) {
        updateData[schemaKey] = body[bodyKey]
      }
    }

    const [data] = await db
      .update(candidates)
      .set(updateData)
      .where(and(eq(candidates.id, id), eq(candidates.companyId, companyId)))
      .returning()

    return NextResponse.json({ candidate: data })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'No company set up. Please create your company in Settings first.' }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function _DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id } = await params

    const [existing] = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(and(eq(candidates.id, id), eq(candidates.companyId, companyId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    // Delete all related records atomically in a transaction
    await db.transaction(async (tx) => {
      await tx.delete(candidateActivities).where(eq(candidateActivities.candidateId, id))
      await tx.delete(candidateReminders).where(eq(candidateReminders.candidateId, id))
      await tx.delete(candidates).where(and(eq(candidates.id, id), eq(candidates.companyId, companyId)))
    })

    return NextResponse.json({ message: 'Candidate deleted successfully' })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'No company set up. Please create your company in Settings first.' }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const PATCH = withApiMiddleware(_PATCH, { csrfProtection: true })
export const DELETE = withApiMiddleware(_DELETE, { csrfProtection: true })
