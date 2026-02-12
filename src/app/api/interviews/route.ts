import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { interviews, candidates, jobs, candidateActivities } from '@/lib/db/schema'
import { eq, and, desc, gte, lte, or, ilike, inArray, sql } from 'drizzle-orm'
import crypto from 'crypto'
import { sendInterviewInvitation } from '@/lib/email/interview-invitation'
import { createZoomMeeting } from '@/lib/integrations/zoom'
import { createInterviewReminders } from '@/lib/services/interview-reminders'
import { z } from 'zod'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { sanitizeUserInput } from '@/lib/security/sanitize'
import { notifyInterviewScheduled } from '@/lib/services/notifications'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { escapeLikePattern } from '@/lib/utils/sql-escape'
import { createLogger } from '@/lib/logger'
import { getDefaultPortalExpiry } from '@/lib/candidate/workspace-lifecycle'

const logger = createLogger('api:interviews')

// Zod validation schema for interview creation
const createInterviewSchema = z.object({
  candidateId: z.string().uuid('Invalid candidate ID format'),
  jobId: z.string().uuid('Invalid job ID format').optional(),
  scheduledAt: z.string().datetime('Invalid date format').refine(
    (date) => new Date(date) > new Date(),
    { message: 'Interview must be scheduled in the future' }
  ),
  durationMinutes: z.number().int().min(15).max(180).default(30),
  interviewType: z.enum(['video', 'phone', 'in_person']).default('video'),
  location: z.string().min(1).max(500).optional(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number').optional(),
  timezone: z.string().default('America/New_York'),
  internalNotes: z.string().max(1000).optional(),
}).refine(
  (data) => data.interviewType !== 'in_person' || data.location,
  { message: 'Location required for in-person interviews', path: ['location'] }
).refine(
  (data) => data.interviewType !== 'phone' || data.phoneNumber,
  { message: 'Phone number required for phone interviews', path: ['phoneNumber'] }
)

// POST /api/interviews - Create a new interview
async function _POST(request: NextRequest) {
  try {
    // Apply rate limiting: 10 interviews per minute per IP
    const rateLimitResult = await rateLimit(request, {
      limit: 10,
      window: 60000, // 1 minute
      identifier: (req) => getIpIdentifier(req),
    })

    if (rateLimitResult) {
      return rateLimitResult // Rate limit exceeded
    }

    const { user, companyId } = await requireCompanyAccess()

    // Parse and validate request body
    const body = await request.json()
    const validationResult = createInterviewSchema.safeParse(body)

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

    let {
      candidateId,
      jobId,
      scheduledAt,
      durationMinutes,
      interviewType,
      location,
      phoneNumber,
      timezone,
      internalNotes,
    } = validationResult.data

    // Sanitize user inputs
    if (location) {
      location = sanitizeUserInput(location, { maxLength: 500, allowNewlines: false })
    }
    if (internalNotes) {
      internalNotes = sanitizeUserInput(internalNotes, { maxLength: 1000, allowNewlines: true })
    }

    // Verify candidate belongs to this company
    const [candidate] = await db
      .select({
        id: candidates.id,
        firstName: candidates.firstName,
        lastName: candidates.lastName,
        email: candidates.email,
        phone: candidates.phone,
      })
      .from(candidates)
      .where(and(eq(candidates.id, candidateId), eq(candidates.companyId, companyId)))
      .limit(1)

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      )
    }

    // Duplicate prevention: Check if a non-cancelled interview already exists for this candidate at this time
    const scheduledDate = new Date(scheduledAt)
    const existingInterview = await db
      .select({ id: interviews.id })
      .from(interviews)
      .where(
        and(
          eq(interviews.candidateId, candidateId),
          eq(interviews.scheduledAt, scheduledDate),
          eq(interviews.companyId, companyId)
        )
      )
      .limit(1)

    if (existingInterview.length > 0) {
      return NextResponse.json(
        {
          error: 'Duplicate interview detected',
          details: 'An interview already exists for this candidate at the specified time',
        },
        { status: 409 }
      )
    }

    // Get job title if jobId provided
    let jobTitle: string | null = null
    if (jobId) {
      const [job] = await db
        .select({ title: jobs.title })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1)
      jobTitle = job?.title || null
    }

    // Generate portal token for candidate
    const portalToken = crypto.randomBytes(32).toString('hex')
    const portalExpiresAt = getDefaultPortalExpiry(scheduledDate)

    // Create the interview
    const [interview] = await db.insert(interviews).values({
      candidateId,
      jobId: jobId || null,
      companyId,
      scheduledAt: scheduledDate,
      durationMinutes,
      interviewType,
      location: location || null,
      phoneNumber: phoneNumber || null,
      candidatePortalToken: portalToken,
      candidatePortalExpiresAt: portalExpiresAt,
      scheduledBy: user.id,
      status: 'scheduled',
    }).returning()

    // Create Zoom meeting for video interviews (if Zoom is configured)
    if (interviewType === 'video') {
      try {
        const zoomMeeting = await createZoomMeeting({
          topic: `Interview: ${candidate.firstName} ${candidate.lastName}${jobTitle ? ` - ${jobTitle}` : ''}`,
          startTime: scheduledDate,
          durationMinutes,
          timezone,
          agenda: `Interview with ${candidate.firstName} ${candidate.lastName}${jobTitle ? ` for ${jobTitle} position` : ''}`,
        })

        // Update interview with Zoom meeting details including passcode
        await db.update(interviews)
          .set({
            zoomMeetingId: zoomMeeting.meetingId,
            zoomJoinUrl: zoomMeeting.joinUrl,
            zoomStartUrl: zoomMeeting.startUrl,
            passcode: zoomMeeting.password, // Persist passcode
          })
          .where(eq(interviews.id, interview.id))

        // Update local interview object for email sending
        interview.zoomMeetingId = zoomMeeting.meetingId
        interview.zoomJoinUrl = zoomMeeting.joinUrl
        interview.zoomStartUrl = zoomMeeting.startUrl
        interview.passcode = zoomMeeting.password
      } catch (error) {
        logger.error({ message: 'Failed to create Zoom meeting', error })
        // Return 503 for Zoom service unavailability
        return NextResponse.json(
          {
            error: 'Zoom service unavailable',
            details: error instanceof Error ? error.message : 'Failed to create Zoom meeting',
          },
          { status: 503 }
        )
      }
    }

    // Log activity on the candidate
    await db.insert(candidateActivities).values({
      candidateId,
      companyId,
      activityType: 'interview_scheduled',
      title: 'Interview Scheduled',
      description: `Interview scheduled for ${scheduledDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}${jobTitle ? ` for ${jobTitle}` : ''}`,
      metadata: {
        interviewId: interview.id,
        scheduledAt,
        durationMinutes,
      },
      performedBy: user.id,
    })

    // Send invitation email (non-blocking)
    if (candidate.email) {
      sendInterviewInvitation({
        candidateEmail: candidate.email,
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        scheduledAt: scheduledDate,
        durationMinutes,
        jobTitle,
        portalUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/${portalToken}`,
      }).catch((err) => {
        logger.error({ message: 'Failed to send interview invitation', error: err })
      })
    }

    // Create interview reminders (non-blocking)
    if (candidate.email) {
      createInterviewReminders({
        interviewId: interview.id,
        scheduledAt: scheduledDate,
        candidateId: candidate.id,
        candidateEmail: candidate.email,
        companyId,
      }).catch((err) => {
        logger.error({ message: 'Failed to create interview reminders', error: err })
      })
    }

    // Send in-app notifications to participants (non-blocking)
    notifyInterviewScheduled(interview.id, user.id, [user.id]).catch((err) => {
      logger.error({ message: 'Failed to send interview scheduled notifications', error: err })
    })

    return NextResponse.json({ interview })
  } catch (error) {
    logger.error({ message: 'Error creating interview', error })

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    // Generic database or server error
    return NextResponse.json(
      {
        error: 'Failed to create interview',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// GET /api/interviews - List interviews for the company with filtering and pagination
async function _GET(request: NextRequest) {
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
    const url = new URL(request.url)

    // Extract filter parameters
    const candidateId = url.searchParams.get('candidateId')
    const statusParam = url.searchParams.get('status')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const search = url.searchParams.get('search')
    const jobId = url.searchParams.get('jobId')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)

    // Parse status filter (can be comma-separated)
    const statusFilters = statusParam ? statusParam.split(',').filter(Boolean) : []

    // Build where conditions
    const conditions = [eq(interviews.companyId, companyId)]

    if (candidateId) {
      conditions.push(eq(interviews.candidateId, candidateId))
    }

    if (statusFilters.length > 0) {
      conditions.push(inArray(interviews.status, statusFilters))
    }

    if (startDate) {
      conditions.push(gte(interviews.scheduledAt, new Date(startDate)))
    }

    if (endDate) {
      const endDateTime = new Date(endDate)
      endDateTime.setHours(23, 59, 59, 999)
      conditions.push(lte(interviews.scheduledAt, endDateTime))
    }

    if (jobId) {
      conditions.push(eq(interviews.jobId, jobId))
    }

    if (search) {
      const escapedSearch = escapeLikePattern(search)
      conditions.push(
        or(
          ilike(candidates.firstName, `%${escapedSearch}%`),
          ilike(candidates.lastName, `%${escapedSearch}%`),
          sql`CONCAT(${candidates.firstName}, ' ', ${candidates.lastName}) ILIKE ${`%${escapedSearch}%`}`
        )!
      )
    }

    // Count total for pagination
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(interviews)
      .leftJoin(candidates, eq(interviews.candidateId, candidates.id))
      .where(and(...conditions))

    const total = countResult?.count || 0
    const totalPages = Math.ceil(total / limit)
    const offset = (page - 1) * limit

    // Fetch paginated results
    const results = await db
      .select({
        id: interviews.id,
        candidateId: interviews.candidateId,
        jobId: interviews.jobId,
        scheduledAt: interviews.scheduledAt,
        durationMinutes: interviews.durationMinutes,
        status: interviews.status,
        zoomJoinUrl: interviews.zoomJoinUrl,
        aiSummary: interviews.aiSummary,
        aiSentimentScore: interviews.aiSentimentScore,
        createdAt: interviews.createdAt,
        candidateFirstName: candidates.firstName,
        candidateLastName: candidates.lastName,
        candidateEmail: candidates.email,
        jobTitle: jobs.title,
      })
      .from(interviews)
      .leftJoin(candidates, eq(interviews.candidateId, candidates.id))
      .leftJoin(jobs, eq(interviews.jobId, jobs.id))
      .where(and(...conditions))
      .orderBy(desc(interviews.scheduledAt))
      .limit(limit)
      .offset(offset)

    return NextResponse.json({
      interviews: results,
      total,
      page,
      totalPages,
      limit,
    })
  } catch (error) {
    logger.error({ message: 'Error listing interviews', error })
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Failed to list interviews' },
      { status: 500 }
    )
  }
}

// Export wrapped handlers with request tracing middleware and CSRF protection
export const POST = withApiMiddleware(_POST, { csrfProtection: true })
export const GET = withApiMiddleware(_GET)
