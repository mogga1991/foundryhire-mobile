/**
 * API Route: GDPR Account Deletion
 *
 * DELETE /api/gdpr/delete - Soft delete user account and anonymize PII
 *
 * Supports both company users and candidate users.
 * Rate limited to 1 request per day per user.
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
  sessions,
  accounts,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { createHash } from 'crypto'
import { rateLimit, getUserIdentifier } from '@/lib/rate-limit'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('api:gdpr-delete')

/**
 * Hash PII for anonymization
 */
function hashPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16)
}

/**
 * DELETE - Soft delete user account and anonymize PII
 */
async function _DELETE(request: NextRequest) {
  try {
    logger.info({ message: 'GDPR deletion request received' })

    // Check for company user session
    const companySession = await getSession()

    // Check for candidate user session
    const candidateSession = await getCandidateSession()

    if (!companySession && !candidateSession) {
      logger.warn({ message: 'GDPR deletion attempt without authentication' })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let userId: string
    let userType: 'company' | 'candidate'
    let deletionSummary: Record<string, unknown>

    // Handle company user deletion
    if (companySession) {
      userId = companySession.user.id
      userType = 'company'

      // Rate limiting: 1 request per day
      const rateLimitResult = await rateLimit(request, {
        limit: 1,
        window: 86400000, // 24 hours
        identifier: () => getUserIdentifier(userId),
      })
      if (rateLimitResult) return rateLimitResult

      logger.info({ message: 'Processing company user deletion', userId })

      // Wrap all deletion operations in a transaction
      await db.transaction(async (tx) => {
        // Anonymize user profile
        const emailHash = hashPII(companySession.user.email || userId)
        await tx
          .update(users)
          .set({
            name: 'Deleted User',
            email: `deleted-${emailHash}@anonymized.local`,
            emailVerified: null,
            image: null,
            passwordHash: null,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))

        // Delete sessions
        await tx.delete(sessions).where(eq(sessions.userId, userId))

        // Delete accounts (OAuth connections)
        await tx.delete(accounts).where(eq(accounts.userId, userId))
      })

      deletionSummary = {
        userType: 'company',
        userId,
        status: 'anonymized',
        message: 'Your account has been anonymized. Personal information has been removed.',
        deletedAt: new Date().toISOString(),
      }
    }
    // Handle candidate user deletion
    else if (candidateSession) {
      userId = candidateSession.candidateId
      userType = 'candidate'

      // Rate limiting: 1 request per day
      const rateLimitResult = await rateLimit(request, {
        limit: 1,
        window: 86400000, // 24 hours
        identifier: () => getUserIdentifier(userId),
      })
      if (rateLimitResult) return rateLimitResult

      logger.info({ message: 'Processing candidate user deletion', userId })

      // Fetch candidate profile
      const [candidateProfile] = await db
        .select()
        .from(candidateUsers)
        .where(eq(candidateUsers.id, userId))
        .limit(1)

      if (!candidateProfile) {
        return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
      }

      // Fetch candidate records first (before transaction)
      const candidateRecords = await db
        .select()
        .from(candidates)
        .where(eq(candidates.email, candidateProfile.email))

      // Wrap all deletion operations in a transaction
      let anonymizedRecordsCount = 0
      await db.transaction(async (tx) => {
        // Anonymize candidate user profile
        const emailHash = hashPII(candidateProfile.email || userId)
        await tx
          .update(candidateUsers)
          .set({
            firstName: 'Deleted',
            lastName: 'User',
            email: `deleted-${emailHash}@anonymized.local`,
            phone: null,
            location: null,
            currentTitle: null,
            currentCompany: null,
            linkedinUrl: null,
            bio: null,
            skills: [],
            resumeUrl: null,
            emailVerified: false,
            passwordHash: 'DELETED',
            updatedAt: new Date(),
          })
          .where(eq(candidateUsers.id, userId))

        // Anonymize candidate records
        for (const candidate of candidateRecords) {
          const candidateEmailHash = hashPII(candidate.email || candidate.id)

          await tx
            .update(candidates)
            .set({
              firstName: 'Deleted',
              lastName: 'User',
              email: `deleted-${candidateEmailHash}@anonymized.local`,
              phone: null,
              linkedinUrl: null,
              githubUrl: null,
              portfolioUrl: null,
              currentTitle: null,
              currentCompany: null,
              location: null,
              skills: null,
              resumeUrl: null,
              resumeText: null,
              coverLetter: null,
              notes: null,
              profileImageUrl: null,
              headline: null,
              about: null,
              experience: null,
              education: null,
              certifications: null,
              socialProfiles: null,
              companyInfo: null,
              gdprDeletedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(candidates.id, candidate.id))

          // Delete interview recordings and transcripts
          const candidateInterviews = await tx
            .select()
            .from(interviews)
            .where(eq(interviews.candidateId, candidate.id))

          for (const interview of candidateInterviews) {
            await tx
              .update(interviews)
              .set({
                recordingUrl: null,
                transcript: null,
                updatedAt: new Date(),
              })
              .where(eq(interviews.id, interview.id))
          }

          anonymizedRecordsCount++
        }
      })

      deletionSummary = {
        userType: 'candidate',
        userId,
        status: 'anonymized',
        anonymizedRecords: {
          candidateProfile: 1,
          candidateRecords: anonymizedRecordsCount,
        },
        message:
          'Your account has been anonymized. Personal information has been removed, but anonymized interview scores are retained for analytics.',
        deletedAt: new Date().toISOString(),
      }
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info({ message: 'User deletion completed successfully', userId, userType })

    return NextResponse.json({
      success: true,
      result: deletionSummary,
    })
  } catch (error) {
    logger.error({ message: 'Error processing user deletion', error })

    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const DELETE = withApiMiddleware(_DELETE, { csrfProtection: true })
