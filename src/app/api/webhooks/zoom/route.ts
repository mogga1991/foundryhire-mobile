/**
 * Zoom Webhook Handler
 *
 * Handles webhook events from Zoom:
 * - Endpoint URL validation (CRC challenge)
 * - Recording lifecycle events (started, stopped, completed)
 * - Meeting lifecycle events (started, ended)
 *
 * Webhook verification uses HMAC SHA-256 with ZOOM_WEBHOOK_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { interviews, webhookEvents } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import crypto from 'crypto'
import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'

const logger = createLogger('zoom-webhook')

// --- Signature Validation ---

function validateZoomWebhook(body: string, headers: Headers): boolean {
  const secret = env.ZOOM_WEBHOOK_SECRET
  if (!secret) {
    logger.warn('[Zoom Webhook] ZOOM_WEBHOOK_SECRET not set, skipping validation')
    return env.NODE_ENV !== 'production'
  }

  const signature = headers.get('x-zm-signature')
  const timestamp = headers.get('x-zm-request-timestamp')

  if (!signature || !timestamp) {
    logger.error('[Zoom Webhook] Missing x-zm-signature or x-zm-request-timestamp headers')
    return false
  }

  // Check timestamp freshness (5 min tolerance)
  const ts = parseInt(timestamp, 10)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > 300) {
    logger.error('[Zoom Webhook] Timestamp too old or in future')
    return false
  }

  // Zoom signature format: v0=<hmac_sha256>
  // Message to sign: v0:{timestamp}:{body}
  const message = `v0:${timestamp}:${body}`
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex')

  const expectedFormatted = `v0=${expectedSignature}`

  if (signature !== expectedFormatted) {
    logger.error('[Zoom Webhook] Signature mismatch')
    return false
  }

  return true
}

// --- Event Types ---

type ZoomEventType =
  | 'endpoint.url_validation'
  | 'recording.started'
  | 'recording.stopped'
  | 'recording.paused'
  | 'recording.resumed'
  | 'recording.completed'
  | 'meeting.started'
  | 'meeting.ended'

interface ZoomWebhookPayload {
  event: ZoomEventType
  event_ts?: number
  payload?: {
    plainToken?: string
    encryptedToken?: string
    account_id?: string
    object?: {
      id?: string | number // Meeting ID
      uuid?: string
      host_id?: string
      topic?: string
      type?: number
      start_time?: string
      duration?: number
      timezone?: string
      recording_files?: Array<{
        id: string
        recording_start: string
        recording_end: string
        file_type: string
        file_size: number
        play_url: string
        download_url: string
        status: string
        recording_type: string
      }>
    }
  }
}

// --- Lookup ---

async function findInterviewByZoomMeetingId(
  zoomMeetingId: string
): Promise<{ id: string; status: string; companyId: string } | null> {
  const [interview] = await db
    .select({
      id: interviews.id,
      status: interviews.status,
      companyId: interviews.companyId,
    })
    .from(interviews)
    .where(eq(interviews.zoomMeetingId, zoomMeetingId))
    .limit(1)

  return interview || null
}

// --- Webhook Idempotency & Retry Logic ---

/**
 * Generate a unique event ID from Zoom payload
 * Uses event type + timestamp + meeting ID for uniqueness
 */
function generateEventId(event: string, eventTs: number | undefined, meetingId: string | number): string {
  const timestamp = eventTs || Date.now()
  return `${event}-${timestamp}-${meetingId}`
}

/**
 * Calculate next retry time using exponential backoff
 * Attempt 1: 5 minutes
 * Attempt 2: 15 minutes
 * Attempt 3: 60 minutes
 */
function calculateNextRetry(attempts: number): Date {
  const delayMinutes = [5, 15, 60][Math.min(attempts, 2)]
  const nextRetry = new Date()
  nextRetry.setMinutes(nextRetry.getMinutes() + delayMinutes)
  return nextRetry
}

/**
 * Check if webhook event has already been processed (idempotency check)
 */
async function checkWebhookIdempotency(
  provider: string,
  eventId: string
): Promise<{ exists: boolean; status?: string; id?: string }> {
  const [existing] = await db
    .select({ id: webhookEvents.id, status: webhookEvents.status })
    .from(webhookEvents)
    .where(and(
      eq(webhookEvents.provider, provider),
      eq(webhookEvents.eventId, eventId)
    ))
    .limit(1)

  if (existing) {
    return { exists: true, status: existing.status, id: existing.id }
  }

  return { exists: false }
}

/**
 * Create webhook event tracking record
 */
async function createWebhookEvent(
  provider: string,
  eventType: string,
  eventId: string,
  meetingId: string | null,
  payload: any
): Promise<string> {
  // Truncate payload if too large (max 10KB)
  let payloadToStore = payload
  const payloadStr = JSON.stringify(payload)
  if (payloadStr.length > 10000) {
    logger.warn({ message: 'Payload too large, truncating', eventId, size: payloadStr.length })
    payloadToStore = { ...payload, _truncated: true, _originalSize: payloadStr.length }
  }

  const [webhookEvent] = await db
    .insert(webhookEvents)
    .values({
      provider,
      eventType,
      eventId,
      meetingId,
      payload: payloadToStore,
      status: 'received',
    })
    .returning({ id: webhookEvents.id })
    .onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.eventId] })

  return webhookEvent?.id || ''
}

/**
 * Update webhook event status
 */
async function updateWebhookEventStatus(
  webhookEventId: string,
  status: 'processing' | 'completed' | 'failed' | 'dead_letter',
  errorMessage?: string
): Promise<void> {
  const now = new Date()

  await db
    .update(webhookEvents)
    .set({
      status,
      lastAttemptAt: now,
      ...(status === 'completed' && { processedAt: now }),
      ...(errorMessage && { errorMessage }),
      attempts: sql`${webhookEvents.attempts} + 1`,
    })
    .where(eq(webhookEvents.id, webhookEventId))
}

/**
 * Update webhook event for retry
 */
async function scheduleWebhookRetry(
  webhookEventId: string,
  attempts: number,
  maxAttempts: number,
  errorMessage: string
): Promise<void> {
  const nextRetryAt = calculateNextRetry(attempts)
  const status = attempts >= maxAttempts ? 'dead_letter' : 'failed'

  await db
    .update(webhookEvents)
    .set({
      status,
      attempts,
      lastAttemptAt: new Date(),
      nextRetryAt: status === 'failed' ? nextRetryAt : null,
      errorMessage,
    })
    .where(eq(webhookEvents.id, webhookEventId))

  logger.info({
    message: 'Webhook retry scheduled',
    webhookEventId,
    attempts,
    maxAttempts,
    nextRetryAt: status === 'failed' ? nextRetryAt : null,
    status,
  })
}

// --- Event Handlers ---

async function handleRecordingStarted(
  interviewId: string,
  eventType: string,
  timestamp: Date
) {
  await db
    .update(interviews)
    .set({
      recordingStatus: 'in_progress',
      webhookLastReceivedAt: timestamp,
      webhookEventType: eventType,
      updatedAt: new Date(),
    })
    .where(eq(interviews.id, interviewId))

  logger.info({ message: 'Recording started', interviewId, eventType })
}

async function handleRecordingStopped(
  interviewId: string,
  eventType: string,
  timestamp: Date
) {
  await db
    .update(interviews)
    .set({
      recordingStatus: 'processing',
      webhookLastReceivedAt: timestamp,
      webhookEventType: eventType,
      updatedAt: new Date(),
    })
    .where(eq(interviews.id, interviewId))

  logger.info({ message: 'Recording stopped', interviewId, eventType })
}

async function handleRecordingPausedOrResumed(
  interviewId: string,
  eventType: string,
  timestamp: Date
) {
  await db
    .update(interviews)
    .set({
      webhookLastReceivedAt: timestamp,
      updatedAt: new Date(),
    })
    .where(eq(interviews.id, interviewId))

  logger.info({ message: 'Recording paused/resumed', interviewId, eventType })
}

async function handleRecordingCompleted(
  interviewId: string,
  eventType: string,
  timestamp: Date,
  recordingFiles?: Array<{
    download_url: string
    file_size: number
    recording_start: string
    recording_end: string
    recording_type: string
  }>
) {
  // Get the first recording file (usually the video file)
  const primaryRecording = recordingFiles?.find(
    (file) => file.recording_type === 'shared_screen_with_speaker_view' || file.recording_type === 'active_speaker'
  ) || recordingFiles?.[0]

  let recordingDuration: number | null = null
  if (primaryRecording?.recording_start && primaryRecording?.recording_end) {
    const start = new Date(primaryRecording.recording_start).getTime()
    const end = new Date(primaryRecording.recording_end).getTime()
    recordingDuration = Math.floor((end - start) / 1000) // Duration in seconds
  }

  await db
    .update(interviews)
    .set({
      recordingStatus: 'completed',
      recordingUrl: primaryRecording?.download_url || null,
      recordingDuration: recordingDuration,
      recordingFileSize: primaryRecording?.file_size || null,
      recordingProcessedAt: new Date(),
      webhookLastReceivedAt: timestamp,
      webhookEventType: eventType,
      updatedAt: new Date(),
    })
    .where(eq(interviews.id, interviewId))

  logger.info({
    message: 'Recording completed',
    interviewId,
    eventType,
    recordingUrl: primaryRecording?.download_url
  })

  // Return the interview ID to trigger post-processing pipeline
  return interviewId
}

async function handleMeetingStarted(
  interviewId: string,
  eventType: string,
  timestamp: Date
) {
  await db
    .update(interviews)
    .set({
      status: 'in_progress',
      webhookLastReceivedAt: timestamp,
      webhookEventType: eventType,
      updatedAt: new Date(),
    })
    .where(eq(interviews.id, interviewId))

  logger.info({ message: 'Meeting started', interviewId, eventType })
}

async function handleMeetingEnded(
  interviewId: string,
  currentStatus: string,
  eventType: string,
  timestamp: Date
) {
  // Only update to 'completed' if currently 'in_progress'
  if (currentStatus === 'in_progress') {
    await db
      .update(interviews)
      .set({
        status: 'completed',
        webhookLastReceivedAt: timestamp,
        webhookEventType: eventType,
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, interviewId))

    logger.info({ message: 'Meeting ended', interviewId, eventType })
  } else {
    // Just update webhook metadata
    await db
      .update(interviews)
      .set({
        webhookLastReceivedAt: timestamp,
        webhookEventType: eventType,
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, interviewId))

    logger.info({
      message: 'Meeting ended but status not in_progress, skipping status update',
      interviewId,
      eventType,
      currentStatus
    })
  }
}

// --- Route Handler ---

export async function POST(req: NextRequest) {
  const rateLimitResult = await rateLimit(req, {
    limit: 60,
    window: 60000,
    identifier: (r) => getIpIdentifier(r),
  })
  if (rateLimitResult) return rateLimitResult

  const body = await req.text()
  let payload: ZoomWebhookPayload

  try {
    payload = JSON.parse(body)
  } catch {
    logger.error('[Zoom Webhook] Invalid JSON')
    // Return 200 to prevent Zoom retries
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 200 })
  }

  // Handle URL validation (CRC challenge)
  if (payload.event === 'endpoint.url_validation') {
    const secret = env.ZOOM_WEBHOOK_SECRET
    if (!secret) {
      logger.error('[Zoom Webhook] ZOOM_WEBHOOK_SECRET not set for URL validation')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    const plainToken = payload.payload?.plainToken
    if (!plainToken) {
      logger.error('[Zoom Webhook] Missing plainToken in URL validation payload')
      return NextResponse.json({ error: 'Missing plainToken' }, { status: 400 })
    }

    const encryptedToken = crypto
      .createHmac('sha256', secret)
      .update(plainToken)
      .digest('hex')

    logger.info('[Zoom Webhook] URL validation successful')
    return NextResponse.json({
      plainToken,
      encryptedToken,
    })
  }

  // Validate webhook signature for regular events
  if (!validateZoomWebhook(body, req.headers)) {
    logger.error('[Zoom Webhook] Invalid webhook signature')
    // Return 200 to prevent Zoom retries (security best practice)
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 200 })
  }

  const { event, event_ts, payload: eventPayload } = payload

  if (!event || !eventPayload?.object?.id) {
    logger.error({ message: '[Zoom Webhook] Missing event or object.id in payload', event })
    // Return 200 to prevent Zoom retries
    return NextResponse.json({ error: 'Missing required fields' }, { status: 200 })
  }

  const zoomMeetingId = eventPayload.object.id.toString()
  const timestamp = event_ts ? new Date(event_ts) : new Date()

  // Generate unique event ID for idempotency
  const eventId = generateEventId(event, event_ts, zoomMeetingId)

  // Check idempotency - has this event been processed already?
  const idempotencyCheck = await checkWebhookIdempotency('zoom', eventId)

  if (idempotencyCheck.exists) {
    if (idempotencyCheck.status === 'completed') {
      logger.info({
        message: 'Webhook event already processed (idempotent)',
        eventId,
        event,
        webhookEventId: idempotencyCheck.id,
      })
      return NextResponse.json({ received: true, cached: true })
    }

    if (idempotencyCheck.status === 'processing') {
      logger.info({
        message: 'Webhook event currently being processed',
        eventId,
        event,
        webhookEventId: idempotencyCheck.id,
      })
      return NextResponse.json({ received: true, processing: true })
    }
  }

  // Create webhook event tracking record
  let webhookEventId: string
  try {
    webhookEventId = await createWebhookEvent('zoom', event, eventId, zoomMeetingId, payload)
    if (!webhookEventId) {
      // Conflict - event already exists (race condition)
      logger.info({ message: 'Webhook event already exists (race)', eventId })
      return NextResponse.json({ received: true, cached: true })
    }
  } catch (err) {
    logger.error({ message: 'Failed to create webhook event', eventId, error: err })
    // Still process the event to avoid data loss
    webhookEventId = ''
  }

  // Look up the interview
  const interview = await findInterviewByZoomMeetingId(zoomMeetingId)

  if (!interview) {
    logger.warn({
      message: 'No interview found for Zoom meeting ID',
      zoomMeetingId,
      event,
    })

    // Mark as completed even though no interview found
    if (webhookEventId) {
      await updateWebhookEventStatus(webhookEventId, 'completed')
    }

    // Return 200 - this might be a non-tracked meeting
    return NextResponse.json({ received: true })
  }

  // Update webhook event to processing status
  if (webhookEventId) {
    await updateWebhookEventStatus(webhookEventId, 'processing')
  }

  // Process events - wrap in try/catch to ensure we always return 200
  try {
    let interviewIdForPipeline: string | null = null

    switch (event) {
      case 'recording.started':
        await handleRecordingStarted(interview.id, event, timestamp)
        break

      case 'recording.stopped':
        await handleRecordingStopped(interview.id, event, timestamp)
        break

      case 'recording.paused':
      case 'recording.resumed':
        await handleRecordingPausedOrResumed(interview.id, event, timestamp)
        break

      case 'recording.completed':
        interviewIdForPipeline = await handleRecordingCompleted(
          interview.id,
          event,
          timestamp,
          eventPayload.object.recording_files
        )
        break

      case 'meeting.started':
        await handleMeetingStarted(interview.id, event, timestamp)
        break

      case 'meeting.ended':
        await handleMeetingEnded(interview.id, interview.status, event, timestamp)
        break

      default:
        logger.info({ message: 'Unhandled Zoom event type', event, interviewId: interview.id })
    }

    // If we have a completed recording, trigger the post-interview pipeline
    if (interviewIdForPipeline && event === 'recording.completed') {
      // Import and call the pipeline asynchronously (don't await to avoid blocking webhook response)
      import('@/lib/services/recording-pipeline').then(async (module) => {
        try {
          logger.info({ message: 'Triggering post-interview pipeline', interviewId: interviewIdForPipeline })
          await module.triggerPostInterviewPipeline(interviewIdForPipeline!)
        } catch (err) {
          logger.error({
            message: 'Post-interview pipeline failed',
            interviewId: interviewIdForPipeline,
            error: err,
          })
        }
      })
    }

    // Mark webhook event as completed
    if (webhookEventId) {
      await updateWebhookEventStatus(webhookEventId, 'completed')
    }

    logger.info({ message: 'Processed Zoom webhook event', event, interviewId: interview.id, webhookEventId })
    return NextResponse.json({ received: true })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    logger.error({
      message: 'Error processing Zoom webhook',
      event,
      interviewId: interview.id,
      error: errorMessage,
    })

    // Schedule retry if we have webhook event ID
    if (webhookEventId) {
      const [webhookEvent] = await db
        .select({ attempts: webhookEvents.attempts, maxAttempts: webhookEvents.maxAttempts })
        .from(webhookEvents)
        .where(eq(webhookEvents.id, webhookEventId))
        .limit(1)

      const attempts = (webhookEvent?.attempts || 0) + 1
      const maxAttempts = webhookEvent?.maxAttempts || 3

      await scheduleWebhookRetry(webhookEventId, attempts, maxAttempts, errorMessage)
    }

    // Return 200 to prevent Zoom retries (we handle retries ourselves)
    return NextResponse.json({ received: true }, { status: 200 })
  }
}
