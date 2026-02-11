/**
 * Resend Webhook Handler
 *
 * Validates webhook signatures (Svix HMAC) and processes email events:
 * - email.delivered -> update campaignSends status
 * - email.opened -> update openedAt
 * - email.clicked -> update clickedAt
 * - email.bounced -> update bouncedAt + add to suppressions
 * - email.complained -> add to suppressions
 *
 * Lookup chain: Resend email_id -> emailQueue.providerMessageId -> campaignSendId -> campaignSends
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { campaignSends, campaigns, emailQueue, emailSuppressions, candidates, webhookIdempotency } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import crypto from 'crypto'
import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'

const logger = createLogger('email-webhook')

// --- Signature Validation ---

function validateResendWebhook(body: string, headers: Headers): boolean {
  const secret = env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    logger.warn({ message: 'RESEND_WEBHOOK_SECRET not set, skipping validation' })
    return env.NODE_ENV !== 'production'
  }

  // Resend uses Svix for webhooks
  const svixId = headers.get('svix-id')
  const svixTimestamp = headers.get('svix-timestamp')
  const svixSignature = headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    logger.error({ message: 'Missing Svix headers' })
    return false
  }

  // Check timestamp freshness (5 min tolerance)
  const ts = parseInt(svixTimestamp, 10)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > 300) {
    logger.error({ message: 'Timestamp too old or in future', timestamp: ts, now })
    return false
  }

  // Svix secret starts with "whsec_", base64 payload follows
  const secretBytes = Buffer.from(
    secret.startsWith('whsec_') ? secret.slice(6) : secret,
    'base64'
  )

  const toSign = `${svixId}.${svixTimestamp}.${body}`
  const expectedSignature = crypto
    .createHmac('sha256', secretBytes)
    .update(toSign)
    .digest('base64')

  // svix-signature can contain multiple signatures like "v1,<sig1> v1,<sig2>"
  const signatures = svixSignature.split(' ')
  for (const sig of signatures) {
    const [version, sigValue] = sig.split(',')
    if (version === 'v1' && sigValue === expectedSignature) {
      return true
    }
  }

  logger.error({ message: 'Signature mismatch' })
  return false
}

// --- Event Types ---

type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.opened'
  | 'email.clicked'
  | 'email.bounced'
  | 'email.complained'

interface ResendWebhookPayload {
  type: ResendEventType
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject?: string
    created_at: string
    bounce?: {
      message: string
      type?: string
    }
    click?: {
      link: string
    }
    [key: string]: unknown
  }
}

// --- Lookup ---

async function findCampaignSendByProviderMessageId(
  providerMessageId: string
): Promise<{ campaignSendId: string; campaignId: string; candidateId: string; companyId: string } | null> {
  const [queueItem] = await db
    .select({
      campaignSendId: emailQueue.campaignSendId,
      companyId: emailQueue.companyId,
    })
    .from(emailQueue)
    .where(eq(emailQueue.providerMessageId, providerMessageId))
    .limit(1)

  if (!queueItem?.campaignSendId) return null

  const [send] = await db
    .select({
      id: campaignSends.id,
      campaignId: campaignSends.campaignId,
      candidateId: campaignSends.candidateId,
    })
    .from(campaignSends)
    .where(eq(campaignSends.id, queueItem.campaignSendId))
    .limit(1)

  if (!send) return null

  return {
    campaignSendId: send.id,
    campaignId: send.campaignId,
    candidateId: send.candidateId,
    companyId: queueItem.companyId,
  }
}

async function getCandidateEmail(candidateId: string): Promise<string | null> {
  const [candidate] = await db
    .select({ email: candidates.email })
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1)
  return candidate?.email ?? null
}

// --- Company Ownership Verification ---

async function verifyCampaignOwnership(
  campaignId: string,
  expectedCompanyId: string
): Promise<boolean> {
  const [campaign] = await db
    .select({ companyId: campaigns.companyId })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1)

  if (!campaign) {
    logger.info({ message: 'Campaign not found during ownership verification', campaignId })
    return false
  }

  const ownershipValid = campaign.companyId === expectedCompanyId
  if (!ownershipValid) {
    logger.info({
      message: 'Campaign ownership verification failed',
      campaignId,
      expectedCompanyId,
      actualCompanyId: campaign.companyId,
    })
  }

  return ownershipValid
}

// --- Event Handlers ---

async function handleDelivered(campaignSendId: string, campaignId: string, timestamp: Date) {
  await db.transaction(async (tx) => {
    await tx
      .update(campaignSends)
      .set({ status: 'delivered', sentAt: timestamp, updatedAt: new Date() })
      .where(eq(campaignSends.id, campaignSendId))

    await tx
      .update(campaigns)
      .set({ totalSent: sql`${campaigns.totalSent} + 1`, updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId))
  })
}

async function handleOpened(campaignSendId: string, campaignId: string, timestamp: Date) {
  await db.transaction(async (tx) => {
    // Only count first open
    const [send] = await tx
      .select({ openedAt: campaignSends.openedAt })
      .from(campaignSends)
      .where(eq(campaignSends.id, campaignSendId))
      .limit(1)

    if (send?.openedAt) return

    await tx
      .update(campaignSends)
      .set({ status: 'opened', openedAt: timestamp, updatedAt: new Date() })
      .where(eq(campaignSends.id, campaignSendId))

    await tx
      .update(campaigns)
      .set({ totalOpened: sql`${campaigns.totalOpened} + 1`, updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId))
  })
}

async function handleClicked(campaignSendId: string, campaignId: string, timestamp: Date) {
  await db.transaction(async (tx) => {
    const [send] = await tx
      .select({ clickedAt: campaignSends.clickedAt })
      .from(campaignSends)
      .where(eq(campaignSends.id, campaignSendId))
      .limit(1)

    if (send?.clickedAt) return

    await tx
      .update(campaignSends)
      .set({ status: 'clicked', clickedAt: timestamp, updatedAt: new Date() })
      .where(eq(campaignSends.id, campaignSendId))

    await tx
      .update(campaigns)
      .set({ totalClicked: sql`${campaigns.totalClicked} + 1`, updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId))
  })
}

async function handleBounced(
  campaignSendId: string,
  campaignId: string,
  companyId: string,
  candidateId: string,
  timestamp: Date,
  bounceMessage?: string
) {
  await db.transaction(async (tx) => {
    await tx
      .update(campaignSends)
      .set({
        status: 'bounced',
        bouncedAt: timestamp,
        errorMessage: bounceMessage || 'Email bounced',
        updatedAt: new Date(),
      })
      .where(eq(campaignSends.id, campaignSendId))

    await tx
      .update(campaigns)
      .set({ totalBounced: sql`${campaigns.totalBounced} + 1`, updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId))

    // Add to suppression list
    const email = await getCandidateEmail(candidateId)
    if (email) {
      await tx
        .insert(emailSuppressions)
        .values({
          companyId,
          email: email.toLowerCase(),
          reason: 'bounce',
          source: campaignSendId,
        })
        .onConflictDoNothing()
    }
  })
}

async function handleComplained(
  campaignSendId: string,
  companyId: string,
  candidateId: string
) {
  await db.transaction(async (tx) => {
    // Add to suppression list
    const email = await getCandidateEmail(candidateId)
    if (email) {
      await tx
        .insert(emailSuppressions)
        .values({
          companyId,
          email: email.toLowerCase(),
          reason: 'complaint',
          source: campaignSendId,
        })
        .onConflictDoNothing()
    }
  })
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

  if (!validateResendWebhook(body, req.headers)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  let payload: ResendWebhookPayload

  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, data, created_at } = payload

  if (!type || !data?.email_id) {
    return NextResponse.json({ error: 'Missing type or email_id' }, { status: 400 })
  }

  // Check idempotency - skip if already processed
  const eventId = data.email_id
  if (eventId) {
    const [existing] = await db
      .select({ id: webhookIdempotency.id })
      .from(webhookIdempotency)
      .where(eq(webhookIdempotency.eventId, String(eventId)))
      .limit(1)

    if (existing) {
      logger.info({ message: 'Skipping duplicate webhook event', eventId, type })
      return NextResponse.json({ received: true, duplicate: true })
    }
  }

  // Look up the campaign send via providerMessageId
  const lookup = await findCampaignSendByProviderMessageId(data.email_id)

  if (!lookup) {
    // Not a tracked email (could be transactional), acknowledge silently
    logger.info({ message: 'No campaign send found for email_id', emailId: data.email_id })
    return NextResponse.json({ received: true })
  }

  const { campaignSendId, campaignId, candidateId, companyId } = lookup
  const timestamp = created_at ? new Date(created_at) : new Date()

  // Verify company ownership to prevent cross-company data manipulation
  const ownershipValid = await verifyCampaignOwnership(campaignId, companyId)
  if (!ownershipValid) {
    logger.info({
      message: 'Webhook rejected: campaign ownership verification failed',
      campaignId,
      companyId,
      eventType: type,
    })
    return NextResponse.json({ error: 'Invalid campaign ownership' }, { status: 403 })
  }

  try {
    switch (type) {
      case 'email.sent':
        // Resend accepted the email, no action needed (we already marked as sent)
        break

      case 'email.delivered':
        await handleDelivered(campaignSendId, campaignId, timestamp)
        break

      case 'email.opened':
        await handleOpened(campaignSendId, campaignId, timestamp)
        break

      case 'email.clicked':
        await handleClicked(campaignSendId, campaignId, timestamp)
        break

      case 'email.bounced':
        await handleBounced(
          campaignSendId,
          campaignId,
          companyId,
          candidateId,
          timestamp,
          data.bounce?.message
        )
        break

      case 'email.complained':
        await handleComplained(campaignSendId, companyId, candidateId)
        break

      case 'email.delivery_delayed':
        // Log but don't change status
        logger.info({ message: 'Delivery delayed for send', campaignSendId })
        break
    }

    // Record the event in idempotency table after successful processing
    if (eventId) {
      await db.insert(webhookIdempotency).values({
        eventId: String(eventId),
        eventType: type,
        source: 'resend',
        payload: payload,
      })
    }

    logger.info({ message: 'Processed webhook event', eventType: type, campaignSendId })
    return NextResponse.json({ received: true })
  } catch (err) {
    logger.error({ message: 'Error processing webhook event', eventType: type, error: err })
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
