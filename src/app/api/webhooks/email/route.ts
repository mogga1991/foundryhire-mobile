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
import { campaignSends, campaigns, emailQueue, emailSuppressions, candidates } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import crypto from 'crypto'

// --- Signature Validation ---

function validateResendWebhook(body: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[Email Webhook] RESEND_WEBHOOK_SECRET not set, skipping validation')
    return process.env.NODE_ENV !== 'production'
  }

  // Resend uses Svix for webhooks
  const svixId = headers.get('svix-id')
  const svixTimestamp = headers.get('svix-timestamp')
  const svixSignature = headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('[Email Webhook] Missing Svix headers')
    return false
  }

  // Check timestamp freshness (5 min tolerance)
  const ts = parseInt(svixTimestamp, 10)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > 300) {
    console.error('[Email Webhook] Timestamp too old or in future')
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

  console.error('[Email Webhook] Signature mismatch')
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

// --- Event Handlers ---

async function handleDelivered(campaignSendId: string, campaignId: string, timestamp: Date) {
  await db
    .update(campaignSends)
    .set({ status: 'delivered', sentAt: timestamp, updatedAt: new Date() })
    .where(eq(campaignSends.id, campaignSendId))

  await db
    .update(campaigns)
    .set({ totalSent: sql`${campaigns.totalSent} + 1`, updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId))
}

async function handleOpened(campaignSendId: string, campaignId: string, timestamp: Date) {
  // Only count first open
  const [send] = await db
    .select({ openedAt: campaignSends.openedAt })
    .from(campaignSends)
    .where(eq(campaignSends.id, campaignSendId))
    .limit(1)

  if (send?.openedAt) return

  await db
    .update(campaignSends)
    .set({ status: 'opened', openedAt: timestamp, updatedAt: new Date() })
    .where(eq(campaignSends.id, campaignSendId))

  await db
    .update(campaigns)
    .set({ totalOpened: sql`${campaigns.totalOpened} + 1`, updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId))
}

async function handleClicked(campaignSendId: string, campaignId: string, timestamp: Date) {
  const [send] = await db
    .select({ clickedAt: campaignSends.clickedAt })
    .from(campaignSends)
    .where(eq(campaignSends.id, campaignSendId))
    .limit(1)

  if (send?.clickedAt) return

  await db
    .update(campaignSends)
    .set({ status: 'clicked', clickedAt: timestamp, updatedAt: new Date() })
    .where(eq(campaignSends.id, campaignSendId))

  await db
    .update(campaigns)
    .set({ totalClicked: sql`${campaigns.totalClicked} + 1`, updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId))
}

async function handleBounced(
  campaignSendId: string,
  campaignId: string,
  companyId: string,
  candidateId: string,
  timestamp: Date,
  bounceMessage?: string
) {
  await db
    .update(campaignSends)
    .set({
      status: 'bounced',
      bouncedAt: timestamp,
      errorMessage: bounceMessage || 'Email bounced',
      updatedAt: new Date(),
    })
    .where(eq(campaignSends.id, campaignSendId))

  await db
    .update(campaigns)
    .set({ totalBounced: sql`${campaigns.totalBounced} + 1`, updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId))

  // Add to suppression list
  const email = await getCandidateEmail(candidateId)
  if (email) {
    await db
      .insert(emailSuppressions)
      .values({
        companyId,
        email: email.toLowerCase(),
        reason: 'bounce',
        source: campaignSendId,
      })
      .onConflictDoNothing()
  }
}

async function handleComplained(
  campaignSendId: string,
  companyId: string,
  candidateId: string
) {
  // Add to suppression list
  const email = await getCandidateEmail(candidateId)
  if (email) {
    await db
      .insert(emailSuppressions)
      .values({
        companyId,
        email: email.toLowerCase(),
        reason: 'complaint',
        source: campaignSendId,
      })
      .onConflictDoNothing()
  }
}

// --- Route Handler ---

export async function POST(req: NextRequest) {
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

  // Look up the campaign send via providerMessageId
  const lookup = await findCampaignSendByProviderMessageId(data.email_id)

  if (!lookup) {
    // Not a tracked email (could be transactional), acknowledge silently
    console.log(`[Email Webhook] No campaign send found for email_id: ${data.email_id}`)
    return NextResponse.json({ received: true })
  }

  const { campaignSendId, campaignId, candidateId, companyId } = lookup
  const timestamp = created_at ? new Date(created_at) : new Date()

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
        console.log(`[Email Webhook] Delivery delayed for send: ${campaignSendId}`)
        break
    }

    console.log(`[Email Webhook] Processed ${type} for send: ${campaignSendId}`)
    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[Email Webhook] Error processing ${type}:`, message)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
