import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { candidateActivities, candidates } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id } = await params

    // Verify candidate belongs to this company
    const [candidate] = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(and(eq(candidates.id, id), eq(candidates.companyId, companyId)))
      .limit(1)

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    const activities = await db
      .select()
      .from(candidateActivities)
      .where(and(eq(candidateActivities.candidateId, id), eq(candidateActivities.companyId, companyId)))
      .orderBy(desc(candidateActivities.createdAt))

    return NextResponse.json({ activities })
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, companyId } = await requireCompanyAccess()
    const { id } = await params
    const body = await request.json()
    const { activityType, title, description } = body

    // Verify candidate belongs to this company
    const [candidate] = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(and(eq(candidates.id, id), eq(candidates.companyId, companyId)))
      .limit(1)

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    const [activity] = await db
      .insert(candidateActivities)
      .values({
        candidateId: id,
        companyId,
        activityType: activityType || 'note',
        title: title || 'Note added',
        description: description || null,
        performedBy: user.id,
      })
      .returning()

    return NextResponse.json({ activity })
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
