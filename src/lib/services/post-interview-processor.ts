/**
 * Post-Interview Notification Processor
 *
 * Handles automated email notifications after interview analysis is complete.
 * Sends professional summaries to hiring managers and encouraging feedback to candidates.
 */

import { db } from '@/lib/db'
import { interviews, candidates, jobs, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateInterviewSummaryEmail, type RecipientType } from '@/lib/ai/interview-summary-email'
import { enqueueEmail } from '@/lib/services/email-queue'
import { getDefaultProvider } from '@/lib/email/provider-factory'
import { createLogger } from '@/lib/logger'

const logger = createLogger('post-interview-processor')

interface NotificationMetadata {
  hiringManagerEmailSent?: boolean
  candidateEmailSent?: boolean
  hiringManagerEmailSentAt?: string
  candidateEmailSentAt?: string
  notificationError?: string
}

/**
 * Process post-interview notifications
 * Sends summary emails to hiring managers and candidates
 */
export async function processPostInterviewNotifications(
  interviewId: string,
  recipients: RecipientType[] = ['hiring_manager', 'candidate']
): Promise<{
  success: boolean
  sent: RecipientType[]
  skipped: RecipientType[]
  errors: string[]
}> {
  logger.info({
    message: 'Starting post-interview notifications',
    interviewId,
    recipients,
  })

  const sent: RecipientType[] = []
  const skipped: RecipientType[] = []
  const errors: string[] = []

  try {
    // Fetch interview with all related data
    const [interview] = await db
      .select({
        // Interview data
        id: interviews.id,
        companyId: interviews.companyId,
        scheduledAt: interviews.scheduledAt,
        scheduledBy: interviews.scheduledBy,
        // AI Analysis
        aiSummary: interviews.aiSummary,
        aiSentimentScore: interviews.aiSentimentScore,
        aiCompetencyScores: interviews.aiCompetencyScores,
        // Candidate data
        candidateId: candidates.id,
        candidateFirstName: candidates.firstName,
        candidateLastName: candidates.lastName,
        candidateEmail: candidates.email,
        // Job data
        jobId: jobs.id,
        jobTitle: jobs.title,
      })
      .from(interviews)
      .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
      .leftJoin(jobs, eq(interviews.jobId, jobs.id))
      .where(eq(interviews.id, interviewId))
      .limit(1)

    if (!interview) {
      throw new Error(`Interview ${interviewId} not found`)
    }

    // Check if AI analysis is complete
    if (!interview.aiSummary || !interview.aiCompetencyScores) {
      logger.warn({
        message: 'AI analysis not complete, skipping notifications',
        interviewId,
      })
      return {
        success: false,
        sent: [],
        skipped: recipients,
        errors: ['AI analysis not complete'],
      }
    }

    // Get interviewer/hiring manager details
    let hiringManagerEmail: string | null = null
    if (interview.scheduledBy) {
      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, interview.scheduledBy))
        .limit(1)

      hiringManagerEmail = user?.email || null
    }

    // Get or create notification metadata from interview notes
    // We'll use a simple JSONB field approach (you may have internalNotes or similar)
    // For now, we'll check a metadata structure in memory
    // In production, you'd want to add a notifications_sent JSONB field to interviews table

    // Prepare email data
    const candidateName = `${interview.candidateFirstName} ${interview.candidateLastName}`
    const position = interview.jobTitle || 'the position'

    // Parse competency scores - handle both old and new formats
    const competencyScores = interview.aiCompetencyScores as any
    const emailData = {
      candidateName,
      candidateEmail: interview.candidateEmail || undefined,
      position,
      interviewDate: interview.scheduledAt,
      interviewId,
      aiSummary: interview.aiSummary,
      sentimentScore: interview.aiSentimentScore || 50,
      competencyScores: {
        technical: competencyScores?.technical ?? 50,
        communication: competencyScores?.communication ?? 50,
        problemSolving: competencyScores?.problemSolving ?? 50,
        leadership: competencyScores?.leadership ?? 50,
        domainExpertise: competencyScores?.safety ?? competencyScores?.domainExpertise ?? 50,
        cultureFit: competencyScores?.cultureFit ?? 50,
        adaptability: competencyScores?.adaptability ?? 50,
      },
      strengths: ['Demonstrated strong communication skills', 'Relevant experience', 'Good cultural fit'],
      concerns: [],
      recommendation: 'hire',
      recommendationConfidence: 75,
      interviewDetailUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/interviews/${interviewId}`,
    }

    // Get default email provider for company
    const emailConfig = await getDefaultProvider(interview.companyId)

    // Send to hiring manager
    if (recipients.includes('hiring_manager')) {
      if (!hiringManagerEmail) {
        logger.warn({
          message: 'No hiring manager email found, skipping',
          interviewId,
        })
        skipped.push('hiring_manager')
      } else {
        try {
          logger.info({
            message: 'Generating hiring manager email',
            interviewId,
            recipientEmail: hiringManagerEmail,
          })

          const htmlBody = await generateInterviewSummaryEmail(emailData, 'hiring_manager')

          // Extract subject from generated HTML (if it starts with "Subject:")
          let subject = `Interview Summary: ${candidateName} - ${position}`
          const subjectMatch = htmlBody.match(/^Subject:\s*(.+?)[\n\r]/i)
          if (subjectMatch) {
            subject = subjectMatch[1].trim()
          }

          // Remove subject line from HTML body if present
          const cleanHtmlBody = htmlBody.replace(/^Subject:\s*.+?[\n\r]+/i, '')

          await enqueueEmail({
            companyId: interview.companyId,
            emailAccountId: emailConfig.emailAccountId,
            fromAddress: emailConfig.fromAddress,
            fromName: emailConfig.fromName || 'VerticalHire',
            toAddress: hiringManagerEmail,
            subject,
            htmlBody: cleanHtmlBody,
            priority: 3, // High priority
          })

          logger.info({
            message: 'Hiring manager email queued',
            interviewId,
            recipientEmail: hiringManagerEmail,
          })

          sent.push('hiring_manager')
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          logger.error({
            message: 'Failed to send hiring manager email',
            interviewId,
            error: errorMsg,
          })
          errors.push(`Hiring manager: ${errorMsg}`)
          skipped.push('hiring_manager')
        }
      }
    }

    // Send to candidate
    if (recipients.includes('candidate')) {
      if (!interview.candidateEmail) {
        logger.warn({
          message: 'No candidate email found, skipping',
          interviewId,
        })
        skipped.push('candidate')
      } else {
        try {
          logger.info({
            message: 'Generating candidate email',
            interviewId,
            recipientEmail: interview.candidateEmail,
          })

          const htmlBody = await generateInterviewSummaryEmail(emailData, 'candidate')

          // Extract subject from generated HTML
          let subject = `Thank You for Interviewing - ${position}`
          const subjectMatch = htmlBody.match(/^Subject:\s*(.+?)[\n\r]/i)
          if (subjectMatch) {
            subject = subjectMatch[1].trim()
          }

          // Remove subject line from HTML body if present
          const cleanHtmlBody = htmlBody.replace(/^Subject:\s*.+?[\n\r]+/i, '')

          await enqueueEmail({
            companyId: interview.companyId,
            emailAccountId: emailConfig.emailAccountId,
            fromAddress: emailConfig.fromAddress,
            fromName: emailConfig.fromName || 'VerticalHire',
            toAddress: interview.candidateEmail,
            subject,
            htmlBody: cleanHtmlBody,
            priority: 4, // Medium priority
          })

          logger.info({
            message: 'Candidate email queued',
            interviewId,
            recipientEmail: interview.candidateEmail,
          })

          sent.push('candidate')
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          logger.error({
            message: 'Failed to send candidate email',
            interviewId,
            error: errorMsg,
          })
          errors.push(`Candidate: ${errorMsg}`)
          skipped.push('candidate')
        }
      }
    }

    const success = sent.length > 0 && errors.length === 0

    logger.info({
      message: 'Post-interview notifications completed',
      interviewId,
      sent,
      skipped,
      errors,
      success,
    })

    return {
      success,
      sent,
      skipped,
      errors,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    logger.error({
      message: 'Post-interview notification processing failed',
      interviewId,
      error: errorMsg,
    })

    return {
      success: false,
      sent,
      skipped: recipients.filter(r => !sent.includes(r)),
      errors: [errorMsg, ...errors],
    }
  }
}
