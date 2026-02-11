/**
 * Notification Service
 *
 * Centralizes notification creation and provides convenience methods
 * for common notification scenarios (interview scheduled, feedback, etc.).
 */

import { db } from '@/lib/db'
import { notifications, teamMembers, interviews, candidates, jobs, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'

const logger = createLogger('notification-service')

// Valid notification types
export type NotificationType =
  | 'interview_scheduled'
  | 'interview_completed'
  | 'candidate_applied'
  | 'feedback_submitted'
  | 'ai_analysis_ready'
  | 'team_invite'
  | 'mention'
  | 'system'

export interface CreateNotificationParams {
  companyId: string
  userId: string
  type: NotificationType
  title: string
  message: string
  actionUrl?: string
  metadata?: Record<string, unknown>
}

/**
 * Create a single notification for a user.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const { companyId, userId, type, title, message, actionUrl, metadata } = params

  try {
    await db.insert(notifications).values({
      companyId,
      userId,
      type,
      title,
      message,
      actionUrl: actionUrl || null,
      metadata: metadata || null,
    })

    logger.info({ message: 'Notification created', companyId, userId, type })
  } catch (error) {
    logger.error({ message: 'Failed to create notification', companyId, userId, type, error })
    throw error
  }
}

/**
 * Send notifications to multiple users at once.
 */
export async function createBulkNotifications(
  notificationsList: CreateNotificationParams[]
): Promise<void> {
  if (notificationsList.length === 0) return

  try {
    await db.insert(notifications).values(
      notificationsList.map((n) => ({
        companyId: n.companyId,
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        actionUrl: n.actionUrl || null,
        metadata: n.metadata || null,
      }))
    )

    logger.info({
      message: 'Bulk notifications created',
      count: notificationsList.length,
      type: notificationsList[0]?.type,
    })
  } catch (error) {
    logger.error({ message: 'Failed to create bulk notifications', error })
    throw error
  }
}

// ============================================================================
// Convenience Methods
// ============================================================================

/**
 * Notify relevant team members when an interview is scheduled.
 */
export async function notifyInterviewScheduled(
  interviewId: string,
  scheduledBy: string,
  participantUserIds: string[]
): Promise<void> {
  try {
    // Fetch interview details
    const [interview] = await db
      .select({
        id: interviews.id,
        companyId: interviews.companyId,
        scheduledAt: interviews.scheduledAt,
        candidateId: interviews.candidateId,
        jobId: interviews.jobId,
      })
      .from(interviews)
      .where(eq(interviews.id, interviewId))
      .limit(1)

    if (!interview) {
      logger.warn({ message: 'Interview not found for notification', interviewId })
      return
    }

    // Fetch candidate name
    const [candidate] = await db
      .select({ firstName: candidates.firstName, lastName: candidates.lastName })
      .from(candidates)
      .where(eq(candidates.id, interview.candidateId))
      .limit(1)

    const candidateName = candidate
      ? `${candidate.firstName} ${candidate.lastName}`
      : 'Unknown Candidate'

    // Fetch job title if available
    let jobTitle = ''
    if (interview.jobId) {
      const [job] = await db
        .select({ title: jobs.title })
        .from(jobs)
        .where(eq(jobs.id, interview.jobId))
        .limit(1)
      jobTitle = job?.title || ''
    }

    const scheduledDate = interview.scheduledAt
      ? new Date(interview.scheduledAt).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'TBD'

    // Notify each participant (except the scheduler)
    const recipientIds = participantUserIds.filter((uid) => uid !== scheduledBy)

    if (recipientIds.length === 0) return

    const notificationsList = recipientIds.map((userId) => ({
      companyId: interview.companyId,
      userId,
      type: 'interview_scheduled' as NotificationType,
      title: 'Interview Scheduled',
      message: `Interview with ${candidateName}${jobTitle ? ` for ${jobTitle}` : ''} scheduled for ${scheduledDate}`,
      actionUrl: `/interviews/${interviewId}`,
      metadata: { interviewId, candidateName, scheduledAt: interview.scheduledAt },
    }))

    await createBulkNotifications(notificationsList)
  } catch (error) {
    logger.error({ message: 'Failed to send interview scheduled notifications', interviewId, error })
  }
}

/**
 * Notify relevant team members when feedback is submitted.
 */
export async function notifyFeedbackSubmitted(
  interviewId: string,
  submittedBy: string
): Promise<void> {
  try {
    const [interview] = await db
      .select({
        id: interviews.id,
        companyId: interviews.companyId,
        candidateId: interviews.candidateId,
        scheduledBy: interviews.scheduledBy,
      })
      .from(interviews)
      .where(eq(interviews.id, interviewId))
      .limit(1)

    if (!interview) return

    // Fetch candidate name
    const [candidate] = await db
      .select({ firstName: candidates.firstName, lastName: candidates.lastName })
      .from(candidates)
      .where(eq(candidates.id, interview.candidateId))
      .limit(1)

    const candidateName = candidate
      ? `${candidate.firstName} ${candidate.lastName}`
      : 'Unknown Candidate'

    // Notify the interview scheduler (if not the person who submitted feedback)
    if (interview.scheduledBy && interview.scheduledBy !== submittedBy) {
      await createNotification({
        companyId: interview.companyId,
        userId: interview.scheduledBy,
        type: 'feedback_submitted',
        title: 'Feedback Submitted',
        message: `New feedback submitted for the interview with ${candidateName}`,
        actionUrl: `/interviews/${interviewId}`,
        metadata: { interviewId, candidateName, submittedBy },
      })
    }
  } catch (error) {
    logger.error({ message: 'Failed to send feedback submitted notification', interviewId, error })
  }
}

/**
 * Notify relevant team members when AI analysis is ready.
 */
export async function notifyAIAnalysisReady(interviewId: string): Promise<void> {
  try {
    const [interview] = await db
      .select({
        id: interviews.id,
        companyId: interviews.companyId,
        candidateId: interviews.candidateId,
        scheduledBy: interviews.scheduledBy,
      })
      .from(interviews)
      .where(eq(interviews.id, interviewId))
      .limit(1)

    if (!interview) return

    const [candidate] = await db
      .select({ firstName: candidates.firstName, lastName: candidates.lastName })
      .from(candidates)
      .where(eq(candidates.id, interview.candidateId))
      .limit(1)

    const candidateName = candidate
      ? `${candidate.firstName} ${candidate.lastName}`
      : 'Unknown Candidate'

    // Notify the scheduler
    if (interview.scheduledBy) {
      await createNotification({
        companyId: interview.companyId,
        userId: interview.scheduledBy,
        type: 'ai_analysis_ready',
        title: 'AI Analysis Ready',
        message: `AI analysis for the interview with ${candidateName} is now available`,
        actionUrl: `/interviews/${interviewId}`,
        metadata: { interviewId, candidateName },
      })
    }
  } catch (error) {
    logger.error({ message: 'Failed to send AI analysis ready notification', interviewId, error })
  }
}

/**
 * Notify about a new team invitation.
 * Sends notification to all admins/owners in the company about the invite.
 */
export async function notifyTeamInvite(
  companyId: string,
  inviteeEmail: string,
  invitedBy: string
): Promise<void> {
  try {
    // Find all owner/admin team members to notify (except the inviter)
    const admins = await db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.companyId, companyId),
          eq(teamMembers.status, 'active')
        )
      )

    const adminRecipients = admins
      .filter((a) => a.userId && a.userId !== invitedBy)
      .map((a) => a.userId!)

    if (adminRecipients.length === 0) return

    const notificationsList = adminRecipients.map((userId) => ({
      companyId,
      userId,
      type: 'team_invite' as NotificationType,
      title: 'New Team Invitation',
      message: `${inviteeEmail} has been invited to join the team`,
      actionUrl: '/settings/team',
      metadata: { inviteeEmail, invitedBy },
    }))

    await createBulkNotifications(notificationsList)
  } catch (error) {
    logger.error({ message: 'Failed to send team invite notification', companyId, inviteeEmail, error })
  }
}

/**
 * Notify candidate when employer reaches out to them.
 * Creates in-app notification for the candidate user.
 */
export async function notifyCandidateReachOut(
  candidateId: string,
  employerId: string,
  companyId: string,
  reachOutId: string
): Promise<void> {
  try {
    // Import candidateUsers to fetch candidate details
    const { candidateUsers } = await import('@/lib/db/schema')

    // Fetch employer name
    const [employer] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, employerId))
      .limit(1)

    const employerName = employer?.name || employer?.email || 'An employer'

    // Fetch company name
    const { companies } = await import('@/lib/db/schema')
    const [company] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1)

    const companyName = company?.name || 'a company'

    // Fetch candidate user ID
    const [candidateUser] = await db
      .select({ id: candidateUsers.id })
      .from(candidateUsers)
      .where(eq(candidateUsers.id, candidateId))
      .limit(1)

    if (!candidateUser) {
      logger.warn({ message: 'Candidate user not found for reach-out notification', candidateId })
      return
    }

    // Create notification for candidate
    await createNotification({
      companyId,
      userId: candidateUser.id,
      type: 'system',
      title: 'New Message from Employer',
      message: `${employerName} from ${companyName} has reached out to you`,
      actionUrl: `/candidate/reach-outs/${reachOutId}`,
      metadata: { reachOutId, employerId, candidateId },
    })

    logger.info({ message: 'Candidate reach-out notification sent', candidateId, reachOutId })
  } catch (error) {
    logger.error({ message: 'Failed to send candidate reach-out notification', candidateId, reachOutId, error })
  }
}
