import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { interviews, candidates, jobs, candidateActivities } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import crypto from 'crypto'
import { sendInterviewInvitation } from '@/lib/email/interview-invitation'
import { createZoomMeeting } from '@/lib/integrations/zoom'

// POST /api/interviews - Create a new interview
export async function POST(request: NextRequest) {
  try {
    const { user, companyId } = await requireCompanyAccess()
    const {
      candidateId,
      jobId,
      scheduledAt,
      durationMinutes,
      interviewType = 'video',
      location,
      phoneNumber,
    } = await request.json()

    if (!candidateId || !scheduledAt) {
      return NextResponse.json(
        { error: 'candidateId and scheduledAt are required' },
        { status: 400 }
      )
    }

    // Validate interview type specific fields
    if (interviewType === 'in_person' && !location) {
      return NextResponse.json(
        { error: 'location is required for in-person interviews' },
        { status: 400 }
      )
    }
    if (interviewType === 'phone' && !phoneNumber) {
      return NextResponse.json(
        { error: 'phoneNumber is required for phone interviews' },
        { status: 400 }
      )
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
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
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
    const portalExpiresAt = new Date(scheduledAt)
    portalExpiresAt.setDate(portalExpiresAt.getDate() + 7)

    // Create the interview
    const [interview] = await db.insert(interviews).values({
      candidateId,
      jobId: jobId || null,
      companyId,
      scheduledAt: new Date(scheduledAt),
      durationMinutes: durationMinutes || 30,
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
          startTime: new Date(scheduledAt),
          durationMinutes: durationMinutes || 30,
          agenda: `Interview with ${candidate.firstName} ${candidate.lastName}${jobTitle ? ` for ${jobTitle} position` : ''}`,
        })

        // Update interview with Zoom meeting details
        await db.update(interviews)
          .set({
            zoomMeetingId: zoomMeeting.meetingId,
            zoomJoinUrl: zoomMeeting.joinUrl,
            zoomStartUrl: zoomMeeting.startUrl,
          })
          .where(eq(interviews.id, interview.id))

        // Update local interview object for email sending
        interview.zoomMeetingId = zoomMeeting.meetingId
        interview.zoomJoinUrl = zoomMeeting.joinUrl
        interview.zoomStartUrl = zoomMeeting.startUrl
      } catch (error) {
        console.error('Failed to create Zoom meeting:', error)
        // Don't fail the whole interview creation if Zoom fails
        // The interview can still be conducted without Zoom
      }
    }

    // Log activity on the candidate
    await db.insert(candidateActivities).values({
      candidateId,
      companyId,
      activityType: 'interview_scheduled',
      title: 'Interview Scheduled',
      description: `Interview scheduled for ${new Date(scheduledAt).toLocaleDateString('en-US', {
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
        durationMinutes: durationMinutes || 30,
      },
      performedBy: user.id,
    })

    // Send invitation email (non-blocking)
    if (candidate.email) {
      sendInterviewInvitation({
        candidateEmail: candidate.email,
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        scheduledAt: new Date(scheduledAt),
        durationMinutes: durationMinutes || 30,
        jobTitle,
        portalUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/${portalToken}`,
      }).catch((err) => {
        console.error('Failed to send interview invitation:', err)
      })
    }

    return NextResponse.json({ interview })
  } catch (error) {
    console.error('Error creating interview:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Failed to create interview' },
      { status: 500 }
    )
  }
}

// GET /api/interviews - List interviews for the company
export async function GET(request: NextRequest) {
  try {
    const { companyId } = await requireCompanyAccess()
    const url = new URL(request.url)
    const candidateId = url.searchParams.get('candidateId')
    const status = url.searchParams.get('status')

    let query = db
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
        jobTitle: jobs.title,
      })
      .from(interviews)
      .leftJoin(candidates, eq(interviews.candidateId, candidates.id))
      .leftJoin(jobs, eq(interviews.jobId, jobs.id))
      .where(eq(interviews.companyId, companyId))
      .orderBy(desc(interviews.scheduledAt))
      .limit(50)

    const results = await query

    return NextResponse.json({ interviews: results })
  } catch (error) {
    console.error('Error listing interviews:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Failed to list interviews' },
      { status: 500 }
    )
  }
}
