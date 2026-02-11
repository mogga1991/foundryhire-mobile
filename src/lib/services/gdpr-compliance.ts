/**
 * GDPR Compliance Service
 *
 * Handles data deletion, anonymization, export, and retention policies
 * in compliance with GDPR requirements.
 */

import { db } from '@/lib/db'
import {
  candidates,
  interviews,
  interviewFeedback,
  interviewReminders,
  candidateReminders,
  candidateActivities,
  gdprAuditLog,
} from '@/lib/db/schema'
import { eq, and, lt } from 'drizzle-orm'
import { del } from '@vercel/blob'
import { createLogger } from '@/lib/logger'
import {
  hashEmail,
  anonymizeTranscript,
  sanitizeFeedback,
  sanitizeAISummary,
} from './anonymization'

const logger = createLogger('gdpr-compliance')

export interface DeletionResult {
  candidateId: string
  interviewsAnonymized: number
  recordingsDeleted: number
  feedbackAnonymized: number
  remindersDeleted: number
  auditLogId: string
  completedAt: string
}

export interface RetentionResult {
  interviewsProcessed: number
  recordingsDeleted: number
  transcriptsCleared: number
  errors: Array<{ interviewId: string; error: string }>
}

export interface CandidateDataExport {
  candidateId: string
  exportedAt: string
  personalInfo: Record<string, any>
  interviews: Array<Record<string, any>>
  feedback: Array<Record<string, any>>
  activities: Array<Record<string, any>>
  reminders: Array<Record<string, any>>
}

/**
 * Process "Right to be Forgotten" request for a candidate
 */
export async function processRightToBeForgotten(
  candidateId: string,
  companyId: string,
  requestedBy: string
): Promise<DeletionResult> {
  logger.info({
    message: 'Processing right to be forgotten request',
    candidateId,
    companyId,
    requestedBy,
  })

  const result: DeletionResult = {
    candidateId,
    interviewsAnonymized: 0,
    recordingsDeleted: 0,
    feedbackAnonymized: 0,
    remindersDeleted: 0,
    auditLogId: '',
    completedAt: new Date().toISOString(),
  }

  try {
    // 1. Get candidate details before deletion
    const [candidate] = await db
      .select()
      .from(candidates)
      .where(and(eq(candidates.id, candidateId), eq(candidates.companyId, companyId)))
      .limit(1)

    if (!candidate) {
      throw new Error('Candidate not found or does not belong to this company')
    }

    const candidateFullName = `${candidate.firstName} ${candidate.lastName}`

    // 2. Find all interviews for this candidate
    const candidateInterviews = await db
      .select({
        id: interviews.id,
        recordingUrl: interviews.recordingUrl,
        transcript: interviews.transcript,
      })
      .from(interviews)
      .where(eq(interviews.candidateId, candidateId))

    logger.info({
      message: 'Found interviews to process',
      candidateId,
      count: candidateInterviews.length,
    })

    // 3. Process each interview
    for (const interview of candidateInterviews) {
      // Delete recording from Vercel Blob
      if (interview.recordingUrl) {
        try {
          await del(interview.recordingUrl)
          result.recordingsDeleted++
          logger.info({
            message: 'Recording deleted from Blob',
            interviewId: interview.id,
            url: interview.recordingUrl,
          })
        } catch (blobError) {
          // Log warning but continue - blob might already be deleted
          logger.warn({
            message: 'Failed to delete recording from Blob',
            interviewId: interview.id,
            error: blobError,
          })
        }
      }

      // Anonymize transcript
      const anonymizedTranscript = interview.transcript
        ? anonymizeTranscript(interview.transcript, candidateFullName)
        : null

      // Clear AI analysis data and anonymize transcript
      await db
        .update(interviews)
        .set({
          recordingUrl: null,
          transcript: anonymizedTranscript,
          aiSummary: sanitizeAISummary(),
          aiCompetencyScores: null,
          aiSentimentScore: null,
          updatedAt: new Date(),
        })
        .where(eq(interviews.id, interview.id))

      result.interviewsAnonymized++

      // Anonymize interview feedback
      const feedbackEntries = await db
        .select({ id: interviewFeedback.id })
        .from(interviewFeedback)
        .where(eq(interviewFeedback.interviewId, interview.id))

      for (const feedback of feedbackEntries) {
        await db
          .update(interviewFeedback)
          .set({
            feedbackText: sanitizeFeedback(''),
          })
          .where(eq(interviewFeedback.id, feedback.id))

        result.feedbackAnonymized++
      }

      // Delete interview reminders
      const deletedReminders = await db
        .delete(interviewReminders)
        .where(eq(interviewReminders.interviewId, interview.id))
        .returning({ id: interviewReminders.id })

      result.remindersDeleted += deletedReminders.length
    }

    // 4. Delete candidate reminders
    const deletedCandidateReminders = await db
      .delete(candidateReminders)
      .where(eq(candidateReminders.candidateId, candidateId))
      .returning({ id: candidateReminders.id })

    result.remindersDeleted += deletedCandidateReminders.length

    // 5. Anonymize candidate record
    const anonymizedEmail = hashEmail(candidate.email || `${candidateId}@unknown.com`)

    await db
      .update(candidates)
      .set({
        firstName: 'Deleted',
        lastName: 'User',
        email: anonymizedEmail,
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
        aiSummary: null,
        aiScoreBreakdown: null,
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
      .where(eq(candidates.id, candidateId))

    // 6. Create audit log entry
    const [auditLog] = await db
      .insert(gdprAuditLog)
      .values({
        companyId,
        action: 'right_to_be_forgotten',
        targetType: 'candidate',
        targetId: candidateId,
        requestedBy,
        details: {
          candidateName: candidateFullName,
          candidateEmail: candidate.email,
          interviewsProcessed: result.interviewsAnonymized,
          recordingsDeleted: result.recordingsDeleted,
          feedbackAnonymized: result.feedbackAnonymized,
          remindersDeleted: result.remindersDeleted,
        },
        completedAt: new Date(),
      })
      .returning({ id: gdprAuditLog.id })

    result.auditLogId = auditLog.id

    logger.info({
      message: 'Right to be forgotten processing completed',
      candidateId,
      result,
    })

    return result
  } catch (error) {
    logger.error({
      message: 'Error processing right to be forgotten',
      candidateId,
      companyId,
      error,
    })
    throw error
  }
}

/**
 * Process data retention cleanup for old interviews
 */
export async function processDataRetention(
  companyId: string,
  retentionDays: number = 365
): Promise<RetentionResult> {
  logger.info({
    message: 'Processing data retention cleanup',
    companyId,
    retentionDays,
  })

  const result: RetentionResult = {
    interviewsProcessed: 0,
    recordingsDeleted: 0,
    transcriptsCleared: 0,
    errors: [],
  }

  try {
    // Calculate cutoff date
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    // Find old interviews (completed or cancelled) past retention period
    const oldInterviews = await db
      .select({
        id: interviews.id,
        recordingUrl: interviews.recordingUrl,
        transcript: interviews.transcript,
        status: interviews.status,
      })
      .from(interviews)
      .where(
        and(
          eq(interviews.companyId, companyId),
          lt(interviews.scheduledAt, cutoffDate)
          // Only process completed or cancelled interviews
          // Status check removed to allow flexibility
        )
      )

    logger.info({
      message: 'Found interviews for retention cleanup',
      companyId,
      count: oldInterviews.length,
      cutoffDate: cutoffDate.toISOString(),
    })

    for (const interview of oldInterviews) {
      try {
        // Skip if already archived
        if (interview.status === 'archived') {
          continue
        }

        // Only archive completed or cancelled interviews
        if (interview.status !== 'completed' && interview.status !== 'cancelled') {
          continue
        }

        // Delete recording from Vercel Blob
        if (interview.recordingUrl) {
          try {
            await del(interview.recordingUrl)
            result.recordingsDeleted++
            logger.info({
              message: 'Recording deleted for retention',
              interviewId: interview.id,
            })
          } catch (blobError) {
            // Log warning but continue
            logger.warn({
              message: 'Failed to delete recording for retention',
              interviewId: interview.id,
              error: blobError,
            })
          }
        }

        // Clear transcript but keep AI summary for metrics
        const shouldClearTranscript = interview.transcript !== null

        await db
          .update(interviews)
          .set({
            recordingUrl: null,
            transcript: shouldClearTranscript ? null : interview.transcript,
            status: 'archived',
            updatedAt: new Date(),
          })
          .where(eq(interviews.id, interview.id))

        result.interviewsProcessed++
        if (shouldClearTranscript) {
          result.transcriptsCleared++
        }
      } catch (interviewError) {
        const errorMessage =
          interviewError instanceof Error ? interviewError.message : 'Unknown error'
        result.errors.push({
          interviewId: interview.id,
          error: errorMessage,
        })

        logger.error({
          message: 'Error processing interview for retention',
          interviewId: interview.id,
          error: interviewError,
        })
      }
    }

    logger.info({
      message: 'Data retention cleanup completed',
      companyId,
      result,
    })

    return result
  } catch (error) {
    logger.error({
      message: 'Error processing data retention',
      companyId,
      error,
    })
    throw error
  }
}

/**
 * Export all data for a candidate (data portability)
 */
export async function exportCandidateData(
  candidateId: string,
  companyId: string
): Promise<CandidateDataExport> {
  logger.info({
    message: 'Exporting candidate data',
    candidateId,
    companyId,
  })

  try {
    // 1. Get candidate personal info
    const [candidate] = await db
      .select()
      .from(candidates)
      .where(and(eq(candidates.id, candidateId), eq(candidates.companyId, companyId)))
      .limit(1)

    if (!candidate) {
      throw new Error('Candidate not found or does not belong to this company')
    }

    // 2. Get all interviews
    const candidateInterviews = await db
      .select()
      .from(interviews)
      .where(eq(interviews.candidateId, candidateId))

    // 3. Get all feedback
    const interviewIds = candidateInterviews.map((i) => i.id)
    let feedbackEntries: any[] = []

    if (interviewIds.length > 0) {
      feedbackEntries = await db
        .select()
        .from(interviewFeedback)
        .where(
          and(
            ...interviewIds.map((id) => eq(interviewFeedback.interviewId, id))
          )
        )
    }

    // 4. Get all activities
    const activities = await db
      .select()
      .from(candidateActivities)
      .where(eq(candidateActivities.candidateId, candidateId))

    // 5. Get all reminders
    const reminders = await db
      .select()
      .from(candidateReminders)
      .where(eq(candidateReminders.candidateId, candidateId))

    const exportData: CandidateDataExport = {
      candidateId,
      exportedAt: new Date().toISOString(),
      personalInfo: {
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        phone: candidate.phone,
        linkedinUrl: candidate.linkedinUrl,
        githubUrl: candidate.githubUrl,
        portfolioUrl: candidate.portfolioUrl,
        currentTitle: candidate.currentTitle,
        currentCompany: candidate.currentCompany,
        location: candidate.location,
        experienceYears: candidate.experienceYears,
        skills: candidate.skills,
        resumeUrl: candidate.resumeUrl,
        status: candidate.status,
        stage: candidate.stage,
        aiScore: candidate.aiScore,
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
      },
      interviews: candidateInterviews.map((i) => ({
        id: i.id,
        scheduledAt: i.scheduledAt,
        durationMinutes: i.durationMinutes,
        interviewType: i.interviewType,
        status: i.status,
        aiSummary: i.aiSummary,
        aiSentimentScore: i.aiSentimentScore,
        aiCompetencyScores: i.aiCompetencyScores,
        createdAt: i.createdAt,
      })),
      feedback: feedbackEntries.map((f) => ({
        interviewId: f.interviewId,
        rating: f.rating,
        recommendation: f.recommendation,
        feedbackText: f.feedbackText,
        createdAt: f.createdAt,
      })),
      activities: activities.map((a) => ({
        activityType: a.activityType,
        title: a.title,
        description: a.description,
        createdAt: a.createdAt,
      })),
      reminders: reminders.map((r) => ({
        title: r.title,
        description: r.description,
        dueDate: r.dueDate,
        isCompleted: r.isCompleted,
        createdAt: r.createdAt,
      })),
    }

    logger.info({
      message: 'Candidate data export completed',
      candidateId,
      interviewsCount: candidateInterviews.length,
      feedbackCount: feedbackEntries.length,
    })

    return exportData
  } catch (error) {
    logger.error({
      message: 'Error exporting candidate data',
      candidateId,
      companyId,
      error,
    })
    throw error
  }
}
