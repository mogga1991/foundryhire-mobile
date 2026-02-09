import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { interviews } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// POST /api/interviews/[id]/transcript - Upload or update interview transcript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params
    const { transcript } = await request.json()

    if (!transcript) {
      return NextResponse.json({ error: 'transcript is required' }, { status: 400 })
    }

    // Verify interview belongs to company
    const [interview] = await db
      .select({ id: interviews.id })
      .from(interviews)
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    // Update transcript
    await db
      .update(interviews)
      .set({
        transcript,
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, interviewId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating transcript:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Failed to update transcript' },
      { status: 500 }
    )
  }
}

// GET /api/interviews/[id]/transcript - Get interview transcript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params

    const [interview] = await db
      .select({
        id: interviews.id,
        transcript: interviews.transcript,
      })
      .from(interviews)
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    return NextResponse.json({ transcript: interview.transcript })
  } catch (error) {
    console.error('Error fetching transcript:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Failed to fetch transcript' },
      { status: 500 }
    )
  }
}
