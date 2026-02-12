import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { interviews, interviewTimeSlots, candidates, companies, jobs } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { rateLimit, RateLimitPresets, getEndpointIdentifier } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { resolveCandidateWorkspaceStatus } from '@/lib/candidate/workspace-lifecycle'

const logger = createLogger('api:interview-candidate-portal')

interface RouteParams {
  params: Promise<{ token: string }>
}

// GET /api/interviews/candidate/[token] - Get interview details and time slots for candidate
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params

    // Find the interview by candidate portal token
    const [interview] = await db
      .select({
        id: interviews.id,
        candidateId: interviews.candidateId,
        scheduledAt: interviews.scheduledAt,
        durationMinutes: interviews.durationMinutes,
        interviewType: interviews.interviewType,
        location: interviews.location,
        phoneNumber: interviews.phoneNumber,
        status: interviews.status,
        candidatePortalExpiresAt: interviews.candidatePortalExpiresAt,
        passcode: interviews.passcode,
        zoomJoinUrl: interviews.zoomJoinUrl,
        zoomMeetingId: interviews.zoomMeetingId,
        interviewQuestions: interviews.interviewQuestions,
        candidateFirstName: candidates.firstName,
        candidateLastName: candidates.lastName,
        candidateEmail: candidates.email,
        candidateStage: candidates.stage,
        companyName: companies.name,
        companyWebsite: companies.website,
        companyId: interviews.companyId,
        jobId: interviews.jobId,
        jobTitle: jobs.title,
        jobLocation: jobs.location,
        jobDepartment: jobs.department,
        jobDescription: jobs.description,
        jobRequirements: jobs.requirements,
        jobSkillsRequired: jobs.skillsRequired,
      })
      .from(interviews)
      .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
      .innerJoin(companies, eq(interviews.companyId, companies.id))
      .leftJoin(jobs, eq(interviews.jobId, jobs.id))
      .where(
        and(
          eq(interviews.candidatePortalToken, token),
          gt(interviews.candidatePortalExpiresAt, new Date())
        )
      )
      .limit(1)

    if (!interview) {
      return NextResponse.json(
        { error: 'Interview not found or link expired' },
        { status: 404 }
      )
    }

    // Get suggested time slots for this interview (if not yet scheduled)
    let timeSlots: Array<{
      id: string
      startTime: Date
      endTime: Date
      aiOptimalityScore: number | null
      aiReasoning: string | null
      status: string
    }> = []
    if (interview.status === 'pending' || !interview.scheduledAt) {
      timeSlots = await db
        .select({
          id: interviewTimeSlots.id,
          startTime: interviewTimeSlots.startTime,
          endTime: interviewTimeSlots.endTime,
          aiOptimalityScore: interviewTimeSlots.aiOptimalityScore,
          aiReasoning: interviewTimeSlots.aiReasoning,
          status: interviewTimeSlots.status,
        })
        .from(interviewTimeSlots)
        .where(
          and(
            eq(interviewTimeSlots.candidateId, interview.candidateId),
            eq(interviewTimeSlots.companyId, interview.companyId)
          )
        )
        .orderBy(interviewTimeSlots.startTime)
        .limit(10)
    }

    return NextResponse.json({
      interview: {
        id: interview.id,
        candidateName: `${interview.candidateFirstName} ${interview.candidateLastName}`,
        candidateEmail: interview.candidateEmail,
        companyName: interview.companyName,
        scheduledAt: interview.scheduledAt,
        durationMinutes: interview.durationMinutes,
        interviewType: interview.interviewType,
        location: interview.location,
        phoneNumber: interview.phoneNumber,
        status: interview.status,
        lifecycleStatus: resolveCandidateWorkspaceStatus({
          interviewStatus: interview.status,
          candidateStage: interview.candidateStage,
          scheduledAt: interview.scheduledAt,
          expiresAt: interview.candidatePortalExpiresAt,
        }),
        passcode: interview.passcode,
        zoomJoinUrl: interview.zoomJoinUrl,
        zoomMeetingId: interview.zoomMeetingId,
        questions: interview.interviewQuestions || [],
      },
      candidate: {
        firstName: interview.candidateFirstName,
        lastName: interview.candidateLastName,
      },
      job: interview.jobTitle ? {
        title: interview.jobTitle,
        location: interview.jobLocation,
        department: interview.jobDepartment,
        description: interview.jobDescription,
        requirements: interview.jobRequirements,
        skillsRequired: interview.jobSkillsRequired,
      } : null,
      company: {
        name: interview.companyName,
        website: interview.companyWebsite,
      },
      timeSlots: timeSlots.map((slot) => ({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        optimalityScore: slot.aiOptimalityScore,
        reasoning: slot.aiReasoning,
        status: slot.status,
        formattedDate: slot.startTime.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
        formattedTime: slot.startTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        }),
      })),
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ message: 'Error fetching interview details', error })
    return NextResponse.json(
      { error: 'Failed to fetch interview details' },
      { status: 500 }
    )
  }
}

// POST /api/interviews/candidate/[token] - Candidate confirms or declines interview
// Supports both time slot selection and direct confirmation/decline
async function _POST(request: NextRequest, { params }: RouteParams) {
  // Apply rate limiting: 5 requests per minute
  const rateLimitResponse = await rateLimit(request, {
    ...RateLimitPresets.strict,
    identifier: (req) => getEndpointIdentifier(req, 'interview-confirm'),
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { token } = await params
    const body = await request.json()
    const { timeSlotId, status: confirmStatus, declineReason } = body

    // Validate input - either timeSlotId OR status must be provided
    if (!timeSlotId && !confirmStatus) {
      return NextResponse.json(
        { error: 'Either timeSlotId or status is required' },
        { status: 400 }
      )
    }

    // Validate status if provided
    if (confirmStatus && !['confirmed', 'declined'].includes(confirmStatus)) {
      return NextResponse.json(
        { error: 'Status must be either "confirmed" or "declined"' },
        { status: 400 }
      )
    }

    // Find the interview by token
    const [interview] = await db
      .select({
        id: interviews.id,
        candidateId: interviews.candidateId,
        companyId: interviews.companyId,
        status: interviews.status,
      })
      .from(interviews)
      .where(
        and(
          eq(interviews.candidatePortalToken, token),
          gt(interviews.candidatePortalExpiresAt, new Date())
        )
      )
      .limit(1)

    if (!interview) {
      return NextResponse.json(
        { error: 'Interview not found or link expired' },
        { status: 404 }
      )
    }

    // Handle time slot selection (existing functionality)
    if (timeSlotId) {
      // Get the selected time slot
      const [timeSlot] = await db
        .select()
        .from(interviewTimeSlots)
        .where(eq(interviewTimeSlots.id, timeSlotId))
        .limit(1)

      if (!timeSlot) {
        return NextResponse.json({ error: 'Time slot not found' }, { status: 404 })
      }

      // Update interview with selected time
      await db
        .update(interviews)
        .set({
          scheduledAt: timeSlot.startTime,
          durationMinutes: Math.round(
            (timeSlot.endTime.getTime() - timeSlot.startTime.getTime()) / 60000
          ),
          status: 'confirmed',
          updatedAt: new Date(),
        })
        .where(eq(interviews.id, interview.id))

      // Update time slot status
      await db
        .update(interviewTimeSlots)
        .set({ status: 'selected' })
        .where(eq(interviewTimeSlots.id, timeSlotId))

      // Mark other slots as rejected
      await db
        .update(interviewTimeSlots)
        .set({ status: 'rejected' })
        .where(
          and(
            eq(interviewTimeSlots.candidateId, interview.candidateId),
            eq(interviewTimeSlots.companyId, interview.companyId),
            eq(interviewTimeSlots.status, 'suggested')
          )
        )

      return NextResponse.json({
        success: true,
        status: 'confirmed',
        scheduledAt: timeSlot.startTime,
      })
    }

    // Handle direct confirmation/decline
    if (confirmStatus === 'confirmed') {
      // Update interview status to confirmed
      const [updatedInterview] = await db
        .update(interviews)
        .set({
          status: 'confirmed',
          updatedAt: new Date(),
        })
        .where(eq(interviews.id, interview.id))
        .returning()

      return NextResponse.json({
        success: true,
        status: 'confirmed',
        interview: updatedInterview,
      })
    }

    if (confirmStatus === 'declined') {
      // Update interview status to cancelled with decline reason
      const [updatedInterview] = await db
        .update(interviews)
        .set({
          status: 'cancelled',
          cancelReason: declineReason || 'Candidate declined',
          candidatePortalExpiresAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(interviews.id, interview.id))
        .returning()

      return NextResponse.json({
        success: true,
        status: 'declined',
        interview: updatedInterview,
      })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ message: 'Error processing interview confirmation', error })
    return NextResponse.json(
      { error: 'Failed to process interview confirmation' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
