/**
 * Interview Reminders Service
 *
 * Handles automatic creation and processing of interview reminders.
 * Sends reminder emails to candidates and interviewers at scheduled times.
 */

import { db } from '@/lib/db'
import { interviewReminders, interviews, candidates, users, interviewParticipants } from '@/lib/db/schema'
import { eq, and, lte, notInArray } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { enqueueEmail } from '@/lib/services/email-queue'
import { env } from '@/lib/env'

const logger = createLogger('interview-reminders')

export interface CreateRemindersParams {
  interviewId: string
  scheduledAt: Date
  candidateId: string
  candidateEmail: string
  companyId: string
}

/**
 * Create all default reminders for an interview.
 * Creates 3 reminder types: 24h before, 1h before, 15min before.
 * Each reminder is created for both candidate and interviewer recipients.
 */
export async function createInterviewReminders(params: CreateRemindersParams): Promise<number> {
  const { interviewId, scheduledAt, candidateId, candidateEmail, companyId } = params

  // Validate scheduledAt is in the future
  if (scheduledAt <= new Date()) {
    logger.warn({ interviewId }, 'Interview scheduled time is in the past, skipping reminder creation')
    return 0
  }

  // Fetch interview details to ensure it exists
  const [interview] = await db
    .select({ id: interviews.id, status: interviews.status })
    .from(interviews)
    .where(eq(interviews.id, interviewId))
    .limit(1)

  if (!interview) {
    logger.error({ interviewId }, 'Interview not found')
    throw new Error('Interview not found')
  }

  // Skip reminders for cancelled interviews
  if (interview.status === 'cancelled') {
    logger.info({ interviewId }, 'Interview is cancelled, skipping reminder creation')
    return 0
  }

  // Get all interview participants (interviewers)
  const participants = await db
    .select({
      userId: interviewParticipants.userId,
      email: users.email,
      name: users.name,
    })
    .from(interviewParticipants)
    .leftJoin(users, eq(interviewParticipants.userId, users.id))
    .where(eq(interviewParticipants.interviewId, interviewId))

  // Define reminder times (in hours before the interview)
  const reminderTypes: Array<{ type: string; hoursBefore: number }> = [
    { type: '24h_before', hoursBefore: 24 },
    { type: '1h_before', hoursBefore: 1 },
    { type: '15min_before', hoursBefore: 0.25 }, // 15 minutes
  ]

  const remindersToCreate = []

  // Create reminders for each type
  for (const { type, hoursBefore } of reminderTypes) {
    const reminderTime = new Date(scheduledAt.getTime() - hoursBefore * 60 * 60 * 1000)

    // Skip if reminder time is in the past
    if (reminderTime <= new Date()) {
      logger.debug({ interviewId, type, reminderTime }, 'Reminder time is in the past, skipping')
      continue
    }

    // Create candidate reminder
    remindersToCreate.push({
      interviewId,
      recipientType: 'candidate',
      recipientEmail: candidateEmail,
      recipientUserId: null,
      reminderType: type,
      scheduledFor: reminderTime,
      status: 'pending',
    })

    // Create interviewer reminders
    for (const participant of participants) {
      if (participant.email) {
        remindersToCreate.push({
          interviewId,
          recipientType: 'interviewer',
          recipientEmail: participant.email,
          recipientUserId: participant.userId,
          reminderType: type,
          scheduledFor: reminderTime,
          status: 'pending',
        })
      }
    }
  }

  if (remindersToCreate.length === 0) {
    logger.info({ interviewId }, 'No reminders to create (all times in the past)')
    return 0
  }

  // Batch insert all reminders
  await db.insert(interviewReminders).values(remindersToCreate)

  logger.info({ interviewId, count: remindersToCreate.length }, 'Created interview reminders')
  return remindersToCreate.length
}

/**
 * Process pending reminders that are due to be sent.
 * Called by cron job every 5 minutes.
 */
export async function processReminders(): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  const now = new Date()

  // Fetch pending reminders that are due
  const pendingReminders = await db
    .select({
      reminder: interviewReminders,
      interview: interviews,
      candidate: candidates,
    })
    .from(interviewReminders)
    .innerJoin(interviews, eq(interviewReminders.interviewId, interviews.id))
    .leftJoin(candidates, eq(interviews.candidateId, candidates.id))
    .where(
      and(
        eq(interviewReminders.status, 'pending'),
        lte(interviewReminders.scheduledFor, now)
      )
    )
    .limit(100) // Process in batches to avoid overwhelming the system

  if (pendingReminders.length === 0) {
    logger.debug('No pending reminders to process')
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  logger.info({ count: pendingReminders.length }, 'Processing interview reminders')

  let succeeded = 0
  let failed = 0

  for (const { reminder, interview, candidate } of pendingReminders) {
    try {
      // Skip reminders for cancelled interviews
      if (interview.status === 'cancelled') {
        await db
          .update(interviewReminders)
          .set({ status: 'cancelled' })
          .where(eq(interviewReminders.id, reminder.id))
        logger.debug({ reminderId: reminder.id }, 'Interview cancelled, marking reminder as cancelled')
        continue
      }

      // Skip if interview has already passed
      if (interview.scheduledAt < now) {
        await db
          .update(interviewReminders)
          .set({ status: 'cancelled' })
          .where(eq(interviewReminders.id, reminder.id))
        logger.debug({ reminderId: reminder.id }, 'Interview has passed, cancelling reminder')
        continue
      }

      // Build email content based on recipient type
      const subject = buildReminderSubject(reminder.reminderType, interview, candidate)
      const htmlBody = buildReminderBody(reminder.recipientType, reminder.reminderType, interview, candidate)

      // Queue the reminder email
      await enqueueEmail({
        companyId: interview.companyId,
        emailAccountId: process.env.DEFAULT_EMAIL_ACCOUNT_ID || '', // Use system email account
        fromAddress: env.RESEND_FROM_EMAIL || 'interviews@verticalhire.com',
        fromName: 'VerticalHire Interviews',
        toAddress: reminder.recipientEmail,
        subject,
        htmlBody,
        priority: reminder.reminderType === '15min_before' ? 3 : 5, // Higher priority for imminent reminders
      })

      // Mark as sent
      await db
        .update(interviewReminders)
        .set({
          status: 'sent',
          sentAt: now,
        })
        .where(eq(interviewReminders.id, reminder.id))

      succeeded++
      logger.debug({ reminderId: reminder.id, recipientEmail: reminder.recipientEmail }, 'Reminder sent successfully')
    } catch (error) {
      // Retry logic: max 3 attempts
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'

      // For now, mark as failed (could implement retry counter in future)
      await db
        .update(interviewReminders)
        .set({
          status: 'failed',
          errorMessage: errorMsg,
        })
        .where(eq(interviewReminders.id, reminder.id))

      failed++
      logger.error({ reminderId: reminder.id, error: errorMsg }, 'Failed to send reminder')
    }
  }

  logger.info({ processed: pendingReminders.length, succeeded, failed }, 'Finished processing reminders')

  return {
    processed: pendingReminders.length,
    succeeded,
    failed,
  }
}

/**
 * Cancel all pending reminders for an interview.
 * Called when an interview is cancelled or rescheduled.
 */
export async function cancelReminders(interviewId: string): Promise<number> {
  const result = await db
    .update(interviewReminders)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(interviewReminders.interviewId, interviewId),
        notInArray(interviewReminders.status, ['sent', 'cancelled'])
      )
    )

  const count = result.rowCount || 0
  logger.info({ interviewId, count }, 'Cancelled interview reminders')
  return count
}

/**
 * Build reminder email subject line
 */
function buildReminderSubject(reminderType: string, interview: typeof interviews.$inferSelect, candidate: typeof candidates.$inferSelect | null): string {
  const candidateName = candidate ? `${candidate.firstName} ${candidate.lastName}` : 'Candidate'

  switch (reminderType) {
    case '24h_before':
      return `Interview Tomorrow with ${candidateName}`
    case '1h_before':
      return `Interview Starting in 1 Hour with ${candidateName}`
    case '15min_before':
      return `Interview Starting in 15 Minutes with ${candidateName}`
    default:
      return `Interview Reminder: ${candidateName}`
  }
}

/**
 * Build reminder email body
 */
function buildReminderBody(
  recipientType: string,
  reminderType: string,
  interview: typeof interviews.$inferSelect,
  candidate: typeof candidates.$inferSelect | null
): string {
  const candidateName = candidate ? `${candidate.firstName} ${candidate.lastName}` : 'Candidate'
  const formattedDate = interview.scheduledAt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const formattedTime = interview.scheduledAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  let timeframe = ''
  switch (reminderType) {
    case '24h_before':
      timeframe = 'tomorrow'
      break
    case '1h_before':
      timeframe = 'in 1 hour'
      break
    case '15min_before':
      timeframe = 'in 15 minutes'
      break
    default:
      timeframe = 'soon'
  }

  const greeting = recipientType === 'candidate' ? `Hi ${candidateName}` : 'Hi'
  const message = recipientType === 'candidate'
    ? `This is a friendly reminder that your interview is scheduled for <strong>${timeframe}</strong>.`
    : `This is a reminder that your interview with <strong>${candidateName}</strong> is scheduled for <strong>${timeframe}</strong>.`

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Interview Reminder</h1>
  </div>

  <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>${greeting},</p>

    <p>${message}</p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date</td>
          <td style="padding: 8px 0; font-weight: 600;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Time</td>
          <td style="padding: 8px 0; font-weight: 600;">${formattedTime}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Duration</td>
          <td style="padding: 8px 0; font-weight: 600;">${interview.durationMinutes} minutes</td>
        </tr>
      </table>
    </div>

    ${interview.zoomJoinUrl ? `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${interview.zoomJoinUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        Join Video Call
      </a>
    </div>
    ${interview.passcode ? `<p style="text-align: center; font-size: 14px; color: #64748b;">Passcode: <strong>${interview.passcode}</strong></p>` : ''}
    ` : ''}

    ${recipientType === 'candidate' ? `
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #92400e;">Preparation Tips</h3>
      <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 14px;">
        <li>Test your audio and video equipment beforehand</li>
        <li>Find a quiet location with good lighting</li>
        <li>Have your resume and any relevant materials ready</li>
        <li>Prepare questions to ask the interviewer</li>
      </ul>
    </div>
    ` : ''}

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
      This is an automated reminder from VerticalHire. If you need to reschedule, please contact your recruiter.
    </p>
  </div>
</body>
</html>`
}
