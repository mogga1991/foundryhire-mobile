/**
 * Webhook Retry Processor
 *
 * Processes failed webhook events with exponential backoff retry logic.
 * Called by a cron job to reprocess webhooks that failed during initial delivery.
 */

import { db } from '@/lib/db'
import { webhookEvents, interviews } from '@/lib/db/schema'
import { eq, and, lte, sql } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'

const logger = createLogger('webhook-retry-processor')

interface WebhookRetryResult {
  processed: number
  succeeded: number
  failed: number
  deadLetters: number
}

/**
 * Process webhook retries for failed events
 * Queries for events that are ready to retry and processes them
 */
export async function processWebhookRetries(): Promise<WebhookRetryResult> {
  const result: WebhookRetryResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    deadLetters: 0,
  }

  try {
    const now = new Date()

    // Query for failed webhooks ready to retry
    const failedEvents = await db
      .select({
        id: webhookEvents.id,
        provider: webhookEvents.provider,
        eventType: webhookEvents.eventType,
        eventId: webhookEvents.eventId,
        meetingId: webhookEvents.meetingId,
        payload: webhookEvents.payload,
        attempts: webhookEvents.attempts,
        maxAttempts: webhookEvents.maxAttempts,
      })
      .from(webhookEvents)
      .where(
        and(
          eq(webhookEvents.status, 'failed'),
          lte(webhookEvents.nextRetryAt, now),
          sql`${webhookEvents.attempts} < ${webhookEvents.maxAttempts}`
        )
      )
      .limit(10) // Process in batches of 10

    logger.info({ message: 'Processing webhook retries', count: failedEvents.length })

    for (const event of failedEvents) {
      result.processed++

      try {
        // Re-process the webhook based on provider
        if (event.provider === 'zoom') {
          await processZoomWebhookRetry(event)
          result.succeeded++
        } else {
          logger.warn({ message: 'Unknown webhook provider', provider: event.provider, eventId: event.eventId })
          result.failed++
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        logger.error({
          message: 'Webhook retry failed',
          webhookEventId: event.id,
          eventType: event.eventType,
          attempts: event.attempts + 1,
          error: errorMessage,
        })

        // Update failure count and schedule next retry
        const newAttempts = event.attempts + 1
        const isDeadLetter = newAttempts >= event.maxAttempts

        if (isDeadLetter) {
          await db
            .update(webhookEvents)
            .set({
              status: 'dead_letter',
              attempts: newAttempts,
              lastAttemptAt: new Date(),
              errorMessage,
            })
            .where(eq(webhookEvents.id, event.id))

          result.deadLetters++
          logger.warn({
            message: 'Webhook moved to dead letter queue',
            webhookEventId: event.id,
            eventType: event.eventType,
            attempts: newAttempts,
          })
        } else {
          // Calculate next retry with exponential backoff
          const nextRetryAt = calculateNextRetry(newAttempts)

          await db
            .update(webhookEvents)
            .set({
              status: 'failed',
              attempts: newAttempts,
              lastAttemptAt: new Date(),
              nextRetryAt,
              errorMessage,
            })
            .where(eq(webhookEvents.id, event.id))

          result.failed++
        }
      }
    }

    logger.info({
      message: 'Webhook retry processing complete',
      ...result,
    })

    return result
  } catch (error) {
    logger.error({
      message: 'Error in webhook retry processor',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Process a Zoom webhook retry
 */
async function processZoomWebhookRetry(event: {
  id: string
  eventType: string
  meetingId: string | null
  payload: any
  attempts: number
}): Promise<void> {
  const { id: webhookEventId, eventType, meetingId, payload } = event

  logger.info({
    message: 'Processing Zoom webhook retry',
    webhookEventId,
    eventType,
    meetingId,
    attempt: event.attempts + 1,
  })

  // Mark as processing
  await db
    .update(webhookEvents)
    .set({
      status: 'processing',
      lastAttemptAt: new Date(),
    })
    .where(eq(webhookEvents.id, webhookEventId))

  if (!meetingId) {
    throw new Error('Missing meeting ID in webhook payload')
  }

  // Look up the interview
  const [interview] = await db
    .select({
      id: interviews.id,
      status: interviews.status,
      companyId: interviews.companyId,
    })
    .from(interviews)
    .where(eq(interviews.zoomMeetingId, meetingId))
    .limit(1)

  if (!interview) {
    throw new Error(`No interview found for Zoom meeting ID: ${meetingId}`)
  }

  const timestamp = payload.event_ts ? new Date(payload.event_ts) : new Date()
  const eventPayload = payload.payload

  // Process the event based on type
  switch (eventType) {
    case 'recording.started':
      await db
        .update(interviews)
        .set({
          recordingStatus: 'in_progress',
          webhookLastReceivedAt: timestamp,
          webhookEventType: eventType,
          updatedAt: new Date(),
        })
        .where(eq(interviews.id, interview.id))
      break

    case 'recording.stopped':
      await db
        .update(interviews)
        .set({
          recordingStatus: 'processing',
          webhookLastReceivedAt: timestamp,
          webhookEventType: eventType,
          updatedAt: new Date(),
        })
        .where(eq(interviews.id, interview.id))
      break

    case 'recording.completed':
      const recordingFiles = eventPayload?.object?.recording_files
      const primaryRecording = recordingFiles?.find(
        (file: any) =>
          file.recording_type === 'shared_screen_with_speaker_view' ||
          file.recording_type === 'active_speaker'
      ) || recordingFiles?.[0]

      let recordingDuration: number | null = null
      if (primaryRecording?.recording_start && primaryRecording?.recording_end) {
        const start = new Date(primaryRecording.recording_start).getTime()
        const end = new Date(primaryRecording.recording_end).getTime()
        recordingDuration = Math.floor((end - start) / 1000)
      }

      await db
        .update(interviews)
        .set({
          recordingStatus: 'completed',
          recordingUrl: primaryRecording?.download_url || null,
          recordingDuration,
          recordingFileSize: primaryRecording?.file_size || null,
          recordingProcessedAt: new Date(),
          webhookLastReceivedAt: timestamp,
          webhookEventType: eventType,
          updatedAt: new Date(),
        })
        .where(eq(interviews.id, interview.id))
      break

    case 'meeting.started':
      await db
        .update(interviews)
        .set({
          status: 'in_progress',
          webhookLastReceivedAt: timestamp,
          webhookEventType: eventType,
          updatedAt: new Date(),
        })
        .where(eq(interviews.id, interview.id))
      break

    case 'meeting.ended':
      if (interview.status === 'in_progress') {
        await db
          .update(interviews)
          .set({
            status: 'completed',
            webhookLastReceivedAt: timestamp,
            webhookEventType: eventType,
            updatedAt: new Date(),
          })
          .where(eq(interviews.id, interview.id))
      } else {
        await db
          .update(interviews)
          .set({
            webhookLastReceivedAt: timestamp,
            webhookEventType: eventType,
            updatedAt: new Date(),
          })
          .where(eq(interviews.id, interview.id))
      }
      break

    default:
      logger.warn({ message: 'Unhandled event type in retry', eventType })
  }

  // Mark as completed
  await db
    .update(webhookEvents)
    .set({
      status: 'completed',
      processedAt: new Date(),
      attempts: sql`${webhookEvents.attempts} + 1`,
    })
    .where(eq(webhookEvents.id, webhookEventId))

  logger.info({
    message: 'Zoom webhook retry successful',
    webhookEventId,
    eventType,
    interviewId: interview.id,
  })
}

/**
 * Calculate next retry time using exponential backoff
 */
function calculateNextRetry(attempts: number): Date {
  const delayMinutes = [5, 15, 60][Math.min(attempts, 2)]
  const nextRetry = new Date()
  nextRetry.setMinutes(nextRetry.getMinutes() + delayMinutes)
  return nextRetry
}
