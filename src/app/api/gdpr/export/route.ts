/**
 * API Route: GDPR Data Export
 *
 * GET /api/gdpr/export - Export all user data (data portability)
 *
 * Supports both company users and candidate users.
 * Rate limited to 1 request per hour per user.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getCandidateSession } from '@/lib/auth/candidate-session'
import { db } from '@/lib/db'
import {
  users,
  candidateUsers,
  candidates,
  interviews,
  interviewFeedback,
  candidateReachOuts,
  candidateActivities,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:gdpr-export')

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string, limit: number = 1, windowMs: number = 3600000): boolean {
  const now = Date.now()
  const key = `export:${userId}`
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}

/**
 * GET - Export all user data as JSON
 */
export async function GET(request: NextRequest) {
  try {
    // Check for company user session
    const companySession = await getSession()

    // Check for candidate user session
    const candidateSession = await getCandidateSession()

    if (!companySession && !candidateSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let userId: string
    let userType: 'company' | 'candidate'
    let exportData: Record<string, unknown>

    // Handle company user export
    if (companySession) {
      userId = companySession.user.id
      userType = 'company'

      // Rate limiting: 1 request per hour
      if (!checkRateLimit(userId, 1, 3600000)) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. You can request data export once per hour.' },
          { status: 429 }
        )
      }

      logger.info({ message: 'Exporting company user data', userId })

      // Fetch user profile
      const [userProfile] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      exportData = {
        userType: 'company',
        profile: {
          id: userProfile?.id,
          name: userProfile?.name,
          email: userProfile?.email,
          emailVerified: userProfile?.emailVerified,
          image: userProfile?.image,
          createdAt: userProfile?.createdAt,
          updatedAt: userProfile?.updatedAt,
        },
        exportDate: new Date().toISOString(),
        note: 'This export contains your personal data. To request deletion, use the account deletion endpoint.',
      }
    }
    // Handle candidate user export
    else if (candidateSession) {
      userId = candidateSession.candidateId
      userType = 'candidate'

      // Rate limiting: 1 request per hour
      if (!checkRateLimit(userId, 1, 3600000)) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. You can request data export once per hour.' },
          { status: 429 }
        )
      }

      logger.info({ message: 'Exporting candidate user data', userId })

      // Fetch candidate profile
      const [candidateProfile] = await db
        .select()
        .from(candidateUsers)
        .where(eq(candidateUsers.id, userId))
        .limit(1)

      // Fetch candidate records from candidates table (if any)
      const candidateRecords = await db
        .select()
        .from(candidates)
        .where(eq(candidates.email, candidateProfile?.email || ''))

      // Fetch interviews
      const candidateInterviews = candidateRecords.length > 0
        ? await db
            .select()
            .from(interviews)
            .where(eq(interviews.candidateId, candidateRecords[0].id))
        : []

      // Fetch feedback
      const feedbackRecords = candidateInterviews.length > 0
        ? await Promise.all(
            candidateInterviews.map((interview) =>
              db
                .select()
                .from(interviewFeedback)
                .where(eq(interviewFeedback.interviewId, interview.id))
            )
          )
        : []

      // Fetch reach-outs
      const reachOuts = candidateRecords.length > 0
        ? await db
            .select()
            .from(candidateReachOuts)
            .where(eq(candidateReachOuts.candidateId, candidateRecords[0].id))
        : []

      // Fetch activities
      const activityRecords = candidateRecords.length > 0
        ? await db
            .select()
            .from(candidateActivities)
            .where(eq(candidateActivities.candidateId, candidateRecords[0].id))
        : []

      exportData = {
        userType: 'candidate',
        profile: {
          id: candidateProfile?.id,
          firstName: candidateProfile?.firstName,
          lastName: candidateProfile?.lastName,
          email: candidateProfile?.email,
          phone: candidateProfile?.phone,
          location: candidateProfile?.location,
          currentTitle: candidateProfile?.currentTitle,
          currentCompany: candidateProfile?.currentCompany,
          experienceYears: candidateProfile?.experienceYears,
          linkedinUrl: candidateProfile?.linkedinUrl,
          bio: candidateProfile?.bio,
          skills: candidateProfile?.skills,
          createdAt: candidateProfile?.createdAt,
          updatedAt: candidateProfile?.updatedAt,
        },
        candidateRecords: candidateRecords.map((rec) => ({
          id: rec.id,
          companyId: rec.companyId,
          jobId: rec.jobId,
          firstName: rec.firstName,
          lastName: rec.lastName,
          email: rec.email,
          phone: rec.phone,
          linkedinUrl: rec.linkedinUrl,
          currentTitle: rec.currentTitle,
          currentCompany: rec.currentCompany,
          location: rec.location,
          status: rec.status,
          stage: rec.stage,
          appliedAt: rec.appliedAt,
          createdAt: rec.createdAt,
        })),
        interviews: candidateInterviews.map((interview) => ({
          id: interview.id,
          companyId: interview.companyId,
          jobId: interview.jobId,
          scheduledAt: interview.scheduledAt,
          status: interview.status,
          createdAt: interview.createdAt,
        })),
        feedback: feedbackRecords.flat().map((fb) => ({
          id: fb.id,
          interviewId: fb.interviewId,
          rating: fb.rating,
          recommendation: fb.recommendation,
          feedbackText: fb.feedbackText,
          createdAt: fb.createdAt,
        })),
        reachOuts: reachOuts.map((reach) => ({
          id: reach.id,
          employerId: reach.employerId,
          companyId: reach.companyId,
          message: reach.message,
          status: reach.status,
          createdAt: reach.createdAt,
        })),
        activities: activityRecords.map((act) => ({
          id: act.id,
          type: act.activityType,
          title: act.title,
          description: act.description,
          createdAt: act.createdAt,
        })),
        exportDate: new Date().toISOString(),
        note: 'This export contains all your personal data. To request deletion, use the account deletion endpoint.',
      }
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info({ message: 'User data exported successfully', userId, userType })

    // Return as JSON download
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="verticalhire-data-export-${userId}-${Date.now()}.json"`,
      },
    })
  } catch (error) {
    logger.error({ message: 'Error exporting user data', error })

    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
