import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { interviewFeedback, interviews } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params
    const { rating, recommendation, feedbackText } = await request.json()

    if (!rating || rating < 1 || rating > 10) {
      return NextResponse.json({ error: 'Rating must be between 1 and 10' }, { status: 400 })
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

    const [feedback] = await db.insert(interviewFeedback).values({
      interviewId,
      userId: user.id,
      rating,
      recommendation: recommendation || null,
      feedbackText: feedbackText || null,
    }).returning()

    return NextResponse.json({ feedback })
  } catch (error) {
    console.error('Error submitting feedback:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params

    const [interview] = await db
      .select({ id: interviews.id })
      .from(interviews)
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    const feedbackList = await db
      .select()
      .from(interviewFeedback)
      .where(eq(interviewFeedback.interviewId, interviewId))

    return NextResponse.json({ feedback: feedbackList })
  } catch (error) {
    console.error('Error fetching feedback:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
  }
}
