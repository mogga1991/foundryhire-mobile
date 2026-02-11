/**
 * Recording Pipeline Service
 *
 * Handles the post-interview recording workflow:
 * 1. Download recording from Zoom
 * 2. Upload to Vercel Blob storage
 * 3. Process transcription (Zoom native or external STT)
 * 4. Trigger AI analysis
 *
 * This is called automatically by the Zoom webhook handler
 * when recording.completed event is received.
 */

import { db } from '@/lib/db'
import { interviews } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { put } from '@vercel/blob'
import { getMeetingRecordings } from '@/lib/integrations/zoom'
import { createLogger } from '@/lib/logger'
import { retryWithBackoff } from '@/lib/utils/retry'

const logger = createLogger('recording-pipeline')

interface RecordingFile {
  id: string
  recording_type: string
  file_type: string
  file_size: number
  download_url: string
  play_url: string
}

/**
 * Download recording from Zoom and upload to Vercel Blob
 */
export async function processRecording(interviewId: string): Promise<void> {
  logger.info({ message: 'Starting recording processing', interviewId })

  try {
    // 1. Get interview details
    const [interview] = await db
      .select({
        id: interviews.id,
        zoomMeetingId: interviews.zoomMeetingId,
        candidateId: interviews.candidateId,
        recordingUrl: interviews.recordingUrl,
      })
      .from(interviews)
      .where(eq(interviews.id, interviewId))
      .limit(1)

    if (!interview) {
      throw new Error(`Interview ${interviewId} not found`)
    }

    if (!interview.zoomMeetingId) {
      throw new Error(`Interview ${interviewId} has no Zoom meeting ID`)
    }

    // 2. Fetch recording files from Zoom
    const recordingData = await getMeetingRecordings(interview.zoomMeetingId)

    if (!recordingData || !recordingData.recordingFiles || recordingData.recordingFiles.length === 0) {
      logger.warn({ message: 'No recording files found', interviewId, zoomMeetingId: interview.zoomMeetingId })

      await db
        .update(interviews)
        .set({
          recordingStatus: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(interviews.id, interviewId))

      return
    }

    // 3. Find the primary video/audio file (MP4 or M4A)
    const primaryFile = recordingData.recordingFiles.find(
      (file: RecordingFile) =>
        (file.recording_type === 'shared_screen_with_speaker_view' ||
          file.recording_type === 'active_speaker' ||
          file.recording_type === 'gallery_view') &&
        (file.file_type === 'MP4' || file.file_type === 'M4A')
    ) || recordingData.recordingFiles.find(
      (file: RecordingFile) => file.file_type === 'MP4' || file.file_type === 'M4A'
    )

    if (!primaryFile) {
      logger.warn({
        message: 'No MP4/M4A recording file found',
        interviewId,
        availableFiles: recordingData.recordingFiles.length,
      })

      await db
        .update(interviews)
        .set({
          recordingStatus: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(interviews.id, interviewId))

      return
    }

    logger.info({
      message: 'Found primary recording file',
      interviewId,
      fileType: primaryFile.file_type,
      fileSize: primaryFile.file_size,
    })

    // 4. Download the recording from Zoom with retry logic
    // The download_url requires an access token
    const { getAccessToken } = await import('@/lib/integrations/zoom')

    logger.info({ message: 'Downloading recording with retry logic', interviewId })

    const recordingBlob = await retryWithBackoff(
      async () => {
        const accessToken = await getAccessToken()

        const downloadResponse = await fetch(primaryFile.download_url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })

        if (!downloadResponse.ok) {
          throw new Error(`Failed to download recording: ${downloadResponse.statusText}`)
        }

        return await downloadResponse.blob()
      },
      { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000 }
    )

    logger.info({ message: 'Recording download successful', interviewId, size: recordingBlob.size })

    // 5. Upload to Vercel Blob
    const fileExtension = primaryFile.file_type.toLowerCase()
    const filename = `recordings/${interview.candidateId}-${interviewId}-${Date.now()}.${fileExtension}`

    logger.info({ message: 'Uploading recording to Vercel Blob', interviewId, filename, size: recordingBlob.size })

    const blob = await put(filename, recordingBlob, {
      access: 'public',
      addRandomSuffix: false,
    })

    logger.info({ message: 'Recording uploaded to Vercel Blob', interviewId, blobUrl: blob.url })

    // 6. Update interview with blob URL
    await db
      .update(interviews)
      .set({
        recordingUrl: blob.url,
        recordingStatus: 'completed',
        recordingProcessedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, interviewId))

    logger.info({ message: 'Recording processing completed successfully', interviewId })
  } catch (error) {
    logger.error({ message: 'Recording processing failed', interviewId, error })

    // Update interview with failed status
    await db
      .update(interviews)
      .set({
        recordingStatus: 'failed',
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, interviewId))

    throw error
  }
}

/**
 * Process transcription from Zoom or external STT service
 */
export async function processTranscription(interviewId: string): Promise<void> {
  logger.info({ message: 'Starting transcription processing', interviewId })

  try {
    // 1. Get interview details
    const [interview] = await db
      .select({
        id: interviews.id,
        zoomMeetingId: interviews.zoomMeetingId,
        transcript: interviews.transcript,
      })
      .from(interviews)
      .where(eq(interviews.id, interviewId))
      .limit(1)

    if (!interview) {
      throw new Error(`Interview ${interviewId} not found`)
    }

    if (!interview.zoomMeetingId) {
      throw new Error(`Interview ${interviewId} has no Zoom meeting ID`)
    }

    // 2. Fetch recording files from Zoom
    const recordingData = await getMeetingRecordings(interview.zoomMeetingId)

    if (!recordingData || !recordingData.recordingFiles) {
      logger.warn({ message: 'No recording data found for transcription', interviewId })

      await db
        .update(interviews)
        .set({
          transcriptStatus: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(interviews.id, interviewId))

      return
    }

    // 3. Check if Zoom's built-in transcript is available
    const transcriptFile = recordingData.recordingFiles.find(
      (file: RecordingFile) => file.recording_type === 'audio_transcript'
    )

    if (transcriptFile) {
      logger.info({ message: 'Found Zoom native transcript, downloading with retry', interviewId })

      // Download the transcript with retry logic
      const { getAccessToken } = await import('@/lib/integrations/zoom')

      const transcriptText = await retryWithBackoff(
        async () => {
          const accessToken = await getAccessToken()

          const transcriptResponse = await fetch(transcriptFile.download_url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          })

          if (!transcriptResponse.ok) {
            throw new Error(`Failed to download transcript: ${transcriptResponse.statusText}`)
          }

          return await transcriptResponse.text()
        },
        { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000 }
      )

      logger.info({ message: 'Transcript download successful', interviewId, length: transcriptText.length })

      // Update interview with transcript
      await db
        .update(interviews)
        .set({
          transcript: transcriptText,
          transcriptStatus: 'completed',
          transcriptProcessedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(interviews.id, interviewId))

      logger.info({ message: 'Zoom transcript processed successfully', interviewId })
    } else {
      // No Zoom transcript available - try Deepgram as fallback
      logger.info({
        message: 'No Zoom transcript available, checking for Deepgram fallback',
        interviewId,
      })

      // Check if Deepgram is configured
      const { validateDeepgramConfig } = await import('@/lib/integrations/deepgram')
      const hasDeepgram = validateDeepgramConfig()

      if (hasDeepgram) {
        // Get the recording URL from the interview
        const [interviewWithRecording] = await db
          .select({
            recordingUrl: interviews.recordingUrl,
          })
          .from(interviews)
          .where(eq(interviews.id, interviewId))
          .limit(1)

        if (!interviewWithRecording?.recordingUrl) {
          logger.warn({
            message: 'No recording URL available for Deepgram transcription',
            interviewId,
          })

          await db
            .update(interviews)
            .set({
              transcriptStatus: 'failed',
              updatedAt: new Date(),
            })
            .where(eq(interviews.id, interviewId))

          return
        }

        try {
          logger.info({
            message: 'Starting Deepgram transcription',
            interviewId,
            recordingUrl: interviewWithRecording.recordingUrl,
          })

          // Mark as processing
          await db
            .update(interviews)
            .set({
              transcriptStatus: 'processing',
              updatedAt: new Date(),
            })
            .where(eq(interviews.id, interviewId))

          // Transcribe with Deepgram
          const { transcribeAudio } = await import('@/lib/integrations/deepgram')
          const result = await transcribeAudio(interviewWithRecording.recordingUrl, {
            language: 'en',
            model: 'nova-2',
            smartFormat: true,
            paragraphs: true,
            diarize: true,
            utterances: true,
          })

          // Store transcript and segment metadata
          await db
            .update(interviews)
            .set({
              transcript: result.transcript,
              transcriptStatus: 'completed',
              transcriptProcessedAt: new Date(),
              updatedAt: new Date(),
              // Store segment data in recordingDuration as metadata (in seconds)
              recordingDuration: Math.floor(result.duration),
            })
            .where(eq(interviews.id, interviewId))

          logger.info({
            message: 'Deepgram transcription completed successfully',
            interviewId,
            duration: result.duration,
            words: result.words,
            confidence: result.confidence,
            segments: result.segments.length,
          })
        } catch (deepgramError) {
          logger.error({
            message: 'Deepgram transcription failed',
            interviewId,
            error: deepgramError,
          })

          await db
            .update(interviews)
            .set({
              transcriptStatus: 'failed',
              updatedAt: new Date(),
            })
            .where(eq(interviews.id, interviewId))
        }
      } else {
        // Neither Zoom nor Deepgram available
        logger.warn({
          message: 'No transcription service available (Zoom native or Deepgram)',
          interviewId,
        })

        await db
          .update(interviews)
          .set({
            transcriptStatus: 'failed',
            updatedAt: new Date(),
          })
          .where(eq(interviews.id, interviewId))
      }
    }
  } catch (error) {
    logger.error({ message: 'Transcription processing failed', interviewId, error })

    // Update interview with failed status
    await db
      .update(interviews)
      .set({
        transcriptStatus: 'failed',
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, interviewId))

    throw error
  }
}

/**
 * Trigger the complete post-interview pipeline
 * Called automatically by Zoom webhook after recording.completed event
 *
 * Pipeline stages are independent - if one fails, progress is preserved
 * and subsequent stages can be retried independently
 */
export async function triggerPostInterviewPipeline(interviewId: string): Promise<void> {
  logger.info({ message: 'Starting post-interview pipeline', interviewId })

  try {
    // Step 1: Process recording (download and upload to Blob)
    // If this fails, recordingStatus will be 'failed' and recording can be retried
    await processRecording(interviewId)
    logger.info({ message: 'Recording processing completed', interviewId })

    // Step 2: Process transcription (try Zoom native, fallback to external STT)
    // If recording succeeded but transcription fails, recordingUrl is preserved
    // and transcription can be retried independently
    await processTranscription(interviewId)
    logger.info({ message: 'Transcription processing completed', interviewId })

    // Step 3: Check if transcript is available and trigger AI analysis
    const [interview] = await db
      .select({
        transcript: interviews.transcript,
        transcriptStatus: interviews.transcriptStatus,
      })
      .from(interviews)
      .where(eq(interviews.id, interviewId))
      .limit(1)

    if (interview?.transcript && interview.transcriptStatus === 'completed') {
      logger.info({ message: 'Transcript available, triggering AI analysis', interviewId })

      try {
        // Import and call the analysis logic directly instead of HTTP fetch
        const { analyzeInterview } = await import('@/lib/ai/interview-scoring')

        // Fetch full interview context for analysis
        const [interviewData] = await db
          .select({
            id: interviews.id,
            transcript: interviews.transcript,
            candidateId: interviews.candidateId,
            jobId: interviews.jobId,
          })
          .from(interviews)
          .where(eq(interviews.id, interviewId))
          .limit(1)

        if (!interviewData?.transcript) {
          logger.warn({ message: 'Transcript not available for analysis', interviewId })
          return
        }

        // Get candidate and job context
        const { candidates, jobs } = await import('@/lib/db/schema')
        const [candidateData] = await db
          .select({
            firstName: candidates.firstName,
            lastName: candidates.lastName,
          })
          .from(candidates)
          .where(eq(candidates.id, interviewData.candidateId))
          .limit(1)

        let jobContext: { title: string; requirements: string[] } | undefined

        if (interviewData.jobId) {
          const [jobData] = await db
            .select({
              title: jobs.title,
              requirements: jobs.requirements,
              skillsRequired: jobs.skillsRequired,
            })
            .from(jobs)
            .where(eq(jobs.id, interviewData.jobId))
            .limit(1)

          if (jobData) {
            jobContext = {
              title: jobData.title,
              requirements: [
                ...(jobData.requirements || []),
                ...(jobData.skillsRequired || []),
              ],
            }
          }
        }

        const candidateContext = candidateData
          ? { name: `${candidateData.firstName} ${candidateData.lastName}` }
          : { name: 'Candidate' }

        // Run enhanced analysis
        logger.info({ message: 'Starting direct AI analysis', interviewId })
        const enhancedAnalysis = await analyzeInterview(
          interviewData.transcript,
          jobContext,
          candidateContext
        )

        // Map enhanced analysis to legacy format for backward compatibility
        const legacyCompetencyScores = {
          technical: enhancedAnalysis.competencyScores.technical.score,
          communication: enhancedAnalysis.competencyScores.communication.score,
          safety: enhancedAnalysis.competencyScores.domainExpertise.score,
          cultureFit: enhancedAnalysis.competencyScores.cultureFit.score,
        }

        // Update interview record with analysis results
        await db
          .update(interviews)
          .set({
            aiSummary: enhancedAnalysis.summary,
            aiSentimentScore: enhancedAnalysis.sentimentScore,
            aiCompetencyScores: legacyCompetencyScores,
            updatedAt: new Date(),
          })
          .where(eq(interviews.id, interviewId))

        logger.info({
          message: 'AI analysis completed successfully',
          interviewId,
          recommendation: enhancedAnalysis.recommendation,
          confidence: enhancedAnalysis.recommendationConfidence,
        })

        // Notify stakeholders that AI analysis is ready (non-blocking)
        const { notifyAIAnalysisReady } = await import('@/lib/services/notifications')
        notifyAIAnalysisReady(interviewId).catch((notificationError) => {
          logger.error({
            message: 'Failed to send AI analysis ready notification',
            interviewId,
            error: notificationError,
          })
        })

        // Trigger post-interview notifications (fire and forget - non-blocking)
        const { processPostInterviewNotifications } = await import('@/lib/services/post-interview-processor')
        processPostInterviewNotifications(interviewId).catch((notificationError) => {
          logger.error({
            message: 'Failed to trigger post-interview notifications',
            interviewId,
            error: notificationError,
          })
        })
      } catch (analyzeError) {
        // Non-critical error - analysis can be triggered manually later
        logger.warn({ message: 'Failed to trigger AI analysis', interviewId, error: analyzeError })
      }
    } else {
      logger.info({
        message: 'Transcript not ready, skipping AI analysis',
        interviewId,
        transcriptStatus: interview?.transcriptStatus,
      })
    }

    logger.info({ message: 'Post-interview pipeline completed successfully', interviewId })
  } catch (error) {
    logger.error({ message: 'Post-interview pipeline failed', interviewId, error })
    // Don't re-throw - we've already logged individual step failures
  }
}
