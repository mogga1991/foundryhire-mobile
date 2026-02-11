import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { interviews, candidates, jobs, interviewParticipants, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { deleteZoomMeeting, createZoomMeeting } from '@/lib/integrations/zoom'
import { cancelReminders, createInterviewReminders } from '@/lib/services/interview-reminders'
import { sendInterviewRescheduled } from '@/lib/email/interview-rescheduled'
import { sendInterviewCancelled } from '@/lib/email/interview-cancelled'
import { sanitizeUserInput } from '@/lib/security/sanitize'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:interviews')

// Interview status state machine - defines valid transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],  // terminal state
  cancelled: [],  // terminal state
}

// GET /api/interviews/[id] - Get interview details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply rate limiting: 30 requests per minute per IP
    const rateLimitResult = await rateLimit(request, {
      limit: 30,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })

    if (rateLimitResult) {
      return rateLimitResult
    }

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
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ message: 'Error fetching interview', error })
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to fetch interview' }, { status: 500 })
  }
}

// Zod validation schema for PATCH
const updateInterviewSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(15).max(180).optional(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
  cancelReason: z.string().max(500).optional(),
  internalNotes: z.string().max(2000).optional(),
  expectedStatus: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
  // Other fields allowed for AI/recording updates
  recordingUrl: z.string().url().optional(),
  transcript: z.string().optional(),
  aiSummary: z.string().optional(),
  aiSentimentScore: z.number().int().min(0).max(100).optional(),
  aiCompetencyScores: z.object({
    technical: z.number(),
    communication: z.number(),
    safety: z.number(),
    cultureFit: z.number(),
  }).optional(),
  interviewQuestions: z.array(z.object({
    id: z.string(),
    question: z.string(),
    answer: z.string().optional(),
    completed: z.boolean(),
  })).optional(),
})

// PATCH /api/interviews/[id] - Update interview (status, recording, reschedule, etc.)
async function _PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply rate limiting: 10 updates per minute per IP
    const rateLimitResult = await rateLimit(request, {
      limit: 10,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })

    if (rateLimitResult) {
      return rateLimitResult
    }

    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params
    const body = await request.json()

    // Validate input
    const validationResult = updateInterviewSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues.map(err => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      )
    }

    // Fetch existing interview with related data
    const [existing] = await db
      .select({
        id: interviews.id,
        scheduledAt: interviews.scheduledAt,
        zoomMeetingId: interviews.zoomMeetingId,
        zoomJoinUrl: interviews.zoomJoinUrl,
        passcode: interviews.passcode,
        durationMinutes: interviews.durationMinutes,
        status: interviews.status,
        candidateId: interviews.candidateId,
        jobId: interviews.jobId,
        candidateFirstName: candidates.firstName,
        candidateLastName: candidates.lastName,
        candidateEmail: candidates.email,
        jobTitle: jobs.title,
      })
      .from(interviews)
      .leftJoin(candidates, eq(interviews.candidateId, candidates.id))
      .leftJoin(jobs, eq(interviews.jobId, jobs.id))
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    // Validate status transition if status is being updated
    if (body.status !== undefined && body.status !== existing.status) {
      const currentStatus = existing.status
      const newStatus = body.status
      const validTransitions = VALID_TRANSITIONS[currentStatus] || []

      if (!validTransitions.includes(newStatus)) {
        return NextResponse.json(
          { error: `Cannot transition from '${currentStatus}' to '${newStatus}'` },
          { status: 422 }
        )
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    let isReschedule = false
    let newScheduledAt: Date | null = null

    // Handle rescheduling logic
    if (body.scheduledAt && body.scheduledAt !== existing.scheduledAt.toISOString()) {
      const newTime = new Date(body.scheduledAt)

      // Validate new time is in the future
      if (newTime <= new Date()) {
        return NextResponse.json(
          { error: 'Interview must be scheduled in the future' },
          { status: 400 }
        )
      }

      // Check for duplicate interviews at new time
      const [duplicate] = await db
        .select({ id: interviews.id })
        .from(interviews)
        .where(
          and(
            eq(interviews.candidateId, existing.candidateId),
            eq(interviews.scheduledAt, newTime),
            eq(interviews.companyId, companyId)
          )
        )
        .limit(1)

      if (duplicate) {
        return NextResponse.json(
          { error: 'An interview already exists for this candidate at the specified time' },
          { status: 409 }
        )
      }

      isReschedule = true
      newScheduledAt = newTime
      updateData.scheduledAt = newTime

      // Delete old Zoom meeting if exists (non-blocking)
      if (existing.zoomMeetingId) {
        try {
          await deleteZoomMeeting(existing.zoomMeetingId)
        } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
          logger.error({ message: 'Failed to delete old Zoom meeting', error })
          // Continue - this is not critical
        }
      }

      // Create new Zoom meeting
      try {
        const zoomMeeting = await createZoomMeeting({
          topic: `Interview: ${existing.candidateFirstName} ${existing.candidateLastName}${existing.jobTitle ? ` - ${existing.jobTitle}` : ''}`,
          startTime: newTime,
          durationMinutes: body.durationMinutes || existing.durationMinutes,
          timezone: 'America/New_York',
          agenda: `Interview with ${existing.candidateFirstName} ${existing.candidateLastName}${existing.jobTitle ? ` for ${existing.jobTitle} position` : ''}`,
        })

        updateData.zoomMeetingId = zoomMeeting.meetingId
        updateData.zoomJoinUrl = zoomMeeting.joinUrl
        updateData.zoomStartUrl = zoomMeeting.startUrl
        updateData.passcode = zoomMeeting.password
      } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
        logger.error({ message: 'Failed to create new Zoom meeting', error })
        // Continue without Zoom meeting - this is not critical
      }

      // Cancel old reminders
      try {
        await cancelReminders(interviewId)
      } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
        logger.error({ message: 'Failed to cancel old reminders', error })
      }
    }

    // Apply other allowed fields with sanitization
    if (body.durationMinutes !== undefined) updateData.durationMinutes = body.durationMinutes
    if (body.status !== undefined) updateData.status = body.status
    if (body.cancelReason !== undefined) {
      updateData.cancelReason = sanitizeUserInput(body.cancelReason, { maxLength: 500, allowNewlines: false })
    }
    if (body.internalNotes !== undefined) {
      updateData.internalNotes = sanitizeUserInput(body.internalNotes, { maxLength: 2000, allowNewlines: true })
    }
    if (body.recordingUrl !== undefined) updateData.recordingUrl = body.recordingUrl
    if (body.transcript !== undefined) updateData.transcript = body.transcript
    if (body.aiSummary !== undefined) updateData.aiSummary = body.aiSummary
    if (body.aiSentimentScore !== undefined) updateData.aiSentimentScore = body.aiSentimentScore
    if (body.aiCompetencyScores !== undefined) updateData.aiCompetencyScores = body.aiCompetencyScores
    if (body.interviewQuestions !== undefined) updateData.interviewQuestions = body.interviewQuestions

    // Update the interview with optimistic locking if expectedStatus is provided
    const whereConditions = [
      eq(interviews.id, interviewId),
      eq(interviews.companyId, companyId),
    ]

    if (body.expectedStatus) {
      whereConditions.push(eq(interviews.status, body.expectedStatus))
    }

    const updatedResults = await db
      .update(interviews)
      .set(updateData)
      .where(and(...whereConditions))
      .returning()

    if (updatedResults.length === 0 && body.expectedStatus) {
      return NextResponse.json(
        { error: 'Interview status has changed, please refresh' },
        { status: 409 }
      )
    }

    if (updatedResults.length === 0) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    const [updated] = updatedResults

    // If rescheduled, create new reminders and send notifications
    if (isReschedule && newScheduledAt && existing.candidateEmail) {
      // Create new reminders (non-blocking)
      createInterviewReminders({
        interviewId,
        scheduledAt: newScheduledAt,
        candidateId: existing.candidateId,
        candidateEmail: existing.candidateEmail,
        companyId,
      }).catch((err) => {
        logger.error({ message: 'Failed to create new reminders', error: err })
      })

      // Send reschedule notification to candidate
      sendInterviewRescheduled({
        recipientEmail: existing.candidateEmail,
        recipientName: `${existing.candidateFirstName} ${existing.candidateLastName}`,
        candidateName: `${existing.candidateFirstName} ${existing.candidateLastName}`,
        jobTitle: existing.jobTitle || null,
        oldScheduledAt: existing.scheduledAt,
        newScheduledAt: newScheduledAt,
        durationMinutes: (body.durationMinutes || existing.durationMinutes) as number,
        zoomJoinUrl: (updateData.zoomJoinUrl as string) || undefined,
        passcode: (updateData.passcode as string) || undefined,
        isCandidate: true,
      }).catch((err) => {
        logger.error({ message: 'Failed to send candidate reschedule notification', error: err })
      })

      // Send reschedule notification to interviewers
      const participants = await db
        .select({
          userId: interviewParticipants.userId,
          email: users.email,
          name: users.name,
        })
        .from(interviewParticipants)
        .leftJoin(users, eq(interviewParticipants.userId, users.id))
        .where(eq(interviewParticipants.interviewId, interviewId))

      for (const participant of participants) {
        if (participant.email) {
          sendInterviewRescheduled({
            recipientEmail: participant.email,
            recipientName: participant.name || 'Interviewer',
            candidateName: `${existing.candidateFirstName} ${existing.candidateLastName}`,
            jobTitle: existing.jobTitle || null,
            oldScheduledAt: existing.scheduledAt,
            newScheduledAt: newScheduledAt,
            durationMinutes: (body.durationMinutes || existing.durationMinutes) as number,
            zoomJoinUrl: (updateData.zoomJoinUrl as string) || undefined,
            passcode: (updateData.passcode as string) || undefined,
            isCandidate: false,
          }).catch((err) => {
            logger.error({ message: 'Failed to send interviewer reschedule notification', error: err })
          })
        }
      }
    }

    return NextResponse.json({ interview: updated })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ message: 'Error updating interview', error })
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to update interview' }, { status: 500 })
  }
}

// DELETE /api/interviews/[id] - Cancel/delete interview
async function _DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply rate limiting: 5 deletions per minute per IP
    const rateLimitResult = await rateLimit(request, {
      limit: 5,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })

    if (rateLimitResult) {
      return rateLimitResult
    }

    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params

    // Get cancelReason from request body if provided
    let cancelReason: string | undefined
    try {
      const body = await request.json()
      if (body.cancelReason) {
        cancelReason = sanitizeUserInput(body.cancelReason, { maxLength: 500, allowNewlines: false })
      }
    } catch {
      // No body provided, that's okay
    }

    // Fetch existing interview with related data
    const [existing] = await db
      .select({
        id: interviews.id,
        status: interviews.status,
        zoomMeetingId: interviews.zoomMeetingId,
        scheduledAt: interviews.scheduledAt,
        durationMinutes: interviews.durationMinutes,
        candidateId: interviews.candidateId,
        candidateFirstName: candidates.firstName,
        candidateLastName: candidates.lastName,
        candidateEmail: candidates.email,
        jobTitle: jobs.title,
      })
      .from(interviews)
      .leftJoin(candidates, eq(interviews.candidateId, candidates.id))
      .leftJoin(jobs, eq(interviews.jobId, jobs.id))
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    // Soft delete - mark as cancelled
    await db
      .update(interviews)
      .set({
        status: 'cancelled',
        cancelReason: cancelReason || 'Interview cancelled',
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, interviewId))

    // Delete Zoom meeting if exists (non-blocking)
    if (existing.zoomMeetingId) {
      try {
        await deleteZoomMeeting(existing.zoomMeetingId)
      } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
        logger.error({ message: 'Failed to delete Zoom meeting', error })
        // Continue - this is not critical
      }
    }

    // Cancel all pending reminders
    try {
      await cancelReminders(interviewId)
    } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
      logger.error({ message: 'Failed to cancel reminders', error })
    }

    // Send cancellation notification to candidate
    if (existing.candidateEmail) {
      sendInterviewCancelled({
        recipientEmail: existing.candidateEmail,
        recipientName: `${existing.candidateFirstName} ${existing.candidateLastName}`,
        candidateName: `${existing.candidateFirstName} ${existing.candidateLastName}`,
        jobTitle: existing.jobTitle || null,
        scheduledAt: existing.scheduledAt,
        durationMinutes: existing.durationMinutes || 30,
        cancelReason,
        isCandidate: true,
      }).catch((err) => {
        logger.error({ message: 'Failed to send candidate cancellation notification', error: err })
      })
    }

    // Send cancellation notification to interviewers
    const participants = await db
      .select({
        userId: interviewParticipants.userId,
        email: users.email,
        name: users.name,
      })
      .from(interviewParticipants)
      .leftJoin(users, eq(interviewParticipants.userId, users.id))
      .where(eq(interviewParticipants.interviewId, interviewId))

    for (const participant of participants) {
      if (participant.email) {
        sendInterviewCancelled({
          recipientEmail: participant.email,
          recipientName: participant.name || 'Interviewer',
          candidateName: `${existing.candidateFirstName} ${existing.candidateLastName}`,
          jobTitle: existing.jobTitle || null,
          scheduledAt: existing.scheduledAt,
          durationMinutes: existing.durationMinutes || 30,
          cancelReason,
          isCandidate: false,
        }).catch((err) => {
          logger.error({ message: 'Failed to send interviewer cancellation notification', error: err })
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ message: 'Error canceling interview', error })
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to cancel interview' }, { status: 500 })
  }
}

export const PATCH = withApiMiddleware(_PATCH, { csrfProtection: true })
export const DELETE = withApiMiddleware(_DELETE, { csrfProtection: true })
