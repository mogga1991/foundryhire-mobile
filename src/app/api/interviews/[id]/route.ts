import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { interviews, candidates, jobs, interviewFeedback } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// GET /api/interviews/[id] - Get interview details
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
        candidateId: interviews.candidateId,
        jobId: interviews.jobId,
        scheduledAt: interviews.scheduledAt,
        durationMinutes: interviews.durationMinutes,
        zoomMeetingId: interviews.zoomMeetingId,
        zoomJoinUrl: interviews.zoomJoinUrl,
        zoomStartUrl: interviews.zoomStartUrl,
        recordingUrl: interviews.recordingUrl,
        transcript: interviews.transcript,
        aiSummary: interviews.aiSummary,
        aiSentimentScore: interviews.aiSentimentScore,
        aiCompetencyScores: interviews.aiCompetencyScores,
        interviewQuestions: interviews.interviewQuestions,
        status: interviews.status,
        cancelReason: interviews.cancelReason,
        createdAt: interviews.createdAt,
        updatedAt: interviews.updatedAt,
        candidateFirstName: candidates.firstName,
        candidateLastName: candidates.lastName,
        candidateEmail: candidates.email,
        jobTitle: jobs.title,
      })
      .from(interviews)
      .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
      .leftJoin(jobs, eq(interviews.jobId, jobs.id))
      .where(
        and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId))
      )
      .limit(1)

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    return NextResponse.json({ interview })
  } catch (error) {
    console.error('Error fetching interview:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to fetch interview' }, { status: 500 })
  }
}

// PATCH /api/interviews/[id] - Update interview (status, recording, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params
    const body = await request.json()

    // Verify ownership
    const [existing] = await db
      .select({ id: interviews.id })
      .from(interviews)
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    // Build update object with only allowed fields
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    const allowedFields = [
      'status', 'cancelReason', 'scheduledAt', 'durationMinutes',
      'zoomMeetingId', 'zoomJoinUrl', 'zoomStartUrl',
      'recordingUrl', 'transcript', 'interviewQuestions',
      'aiSummary', 'aiSentimentScore', 'aiCompetencyScores',
    ]
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const [updated] = await db
      .update(interviews)
      .set(updateData)
      .where(eq(interviews.id, interviewId))
      .returning()

    return NextResponse.json({ interview: updated })
  } catch (error) {
    console.error('Error updating interview:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to update interview' }, { status: 500 })
  }
}

// DELETE /api/interviews/[id] - Cancel/delete interview
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params

    const [existing] = await db
      .select({ id: interviews.id, status: interviews.status })
      .from(interviews)
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    // Soft delete - mark as canceled
    await db
      .update(interviews)
      .set({ status: 'canceled', updatedAt: new Date() })
      .where(eq(interviews.id, interviewId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error canceling interview:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to cancel interview' }, { status: 500 })
  }
}
