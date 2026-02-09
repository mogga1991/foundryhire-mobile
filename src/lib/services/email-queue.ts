/**
 * Email Queue Service
 *
 * Database-backed email queue modeled after the enrichment queue pattern.
 * Processes pending emails with retry logic and exponential backoff.
 */

import { db } from '@/lib/db'
import { emailQueue, campaignSends, campaigns, emailSuppressions, emailAccounts } from '@/lib/db/schema'
import { eq, and, lte, asc, sql, count } from 'drizzle-orm'
import { getEmailProvider } from '@/lib/email/provider-factory'
import { injectTracking, injectUnsubscribe } from '@/lib/email/tracking'

export interface EmailQueueStatus {
  pending: number
  inProgress: number
  sent: number
  failed: number
}

/**
 * Enqueue an email for sending.
 */
export async function enqueueEmail(params: {
  companyId: string
  emailAccountId: string
  campaignSendId?: string
  fromAddress: string
  fromName?: string
  toAddress: string
  subject: string
  htmlBody: string
  textBody?: string
  replyTo?: string
  headers?: Record<string, string>
  scheduledFor?: Date
  priority?: number
}): Promise<string> {
  const [item] = await db
    .insert(emailQueue)
    .values({
      companyId: params.companyId,
      emailAccountId: params.emailAccountId,
      campaignSendId: params.campaignSendId || null,
      fromAddress: params.fromAddress,
      fromName: params.fromName || null,
      toAddress: params.toAddress,
      subject: params.subject,
      htmlBody: params.htmlBody,
      textBody: params.textBody || null,
      replyTo: params.replyTo || null,
      headers: params.headers || null,
      scheduledFor: params.scheduledFor || null,
      priority: params.priority ?? 5,
    })
    .returning({ id: emailQueue.id })

  return item.id
}

/**
 * Process a batch of pending emails.
 */
export async function processEmailBatch(
  batchSize: number = 50
): Promise<{
  processed: number
  succeeded: number
  failed: number
  remaining: number
}> {
  const now = new Date()

  // Fetch next batch of ready-to-send emails
  const items = await db
    .select()
    .from(emailQueue)
    .where(and(
      eq(emailQueue.status, 'pending'),
      lte(emailQueue.nextAttemptAt, now),
      // Only pick up items where scheduledFor is null or in the past
      sql`(${emailQueue.scheduledFor} IS NULL OR ${emailQueue.scheduledFor} <= ${now})`
    ))
    .orderBy(asc(emailQueue.priority), asc(emailQueue.nextAttemptAt))
    .limit(batchSize)

  let succeeded = 0
  let failed = 0

  for (const item of items) {
    // Mark as in_progress
    await db
      .update(emailQueue)
      .set({ status: 'in_progress', lastAttemptAt: now, updatedAt: now })
      .where(eq(emailQueue.id, item.id))

    try {
      // Check suppression list before sending
      if (item.campaignSendId) {
        const [suppression] = await db
          .select({ id: emailSuppressions.id })
          .from(emailSuppressions)
          .where(and(
            eq(emailSuppressions.companyId, item.companyId),
            eq(emailSuppressions.email, item.toAddress.toLowerCase())
          ))
          .limit(1)

        if (suppression) {
          await db
            .update(emailQueue)
            .set({ status: 'cancelled', lastError: 'Recipient is suppressed', updatedAt: new Date() })
            .where(eq(emailQueue.id, item.id))
          if (item.campaignSendId) {
            await db
              .update(campaignSends)
              .set({ status: 'cancelled', errorMessage: 'Suppressed', updatedAt: new Date() })
              .where(eq(campaignSends.id, item.campaignSendId))
          }
          continue
        }
      }

      // Inject tracking and unsubscribe
      let htmlBody = item.htmlBody
      let additionalHeaders: Record<string, string> = {}

      if (item.campaignSendId) {
        htmlBody = injectTracking({ html: htmlBody, campaignSendId: item.campaignSendId })
        const unsub = injectUnsubscribe({
          html: htmlBody,
          campaignSendId: item.campaignSendId,
          companyId: item.companyId,
        })
        htmlBody = unsub.html
        additionalHeaders = unsub.headers
      }

      // Get provider and send
      if (!item.emailAccountId) {
        throw new Error('No email account ID on queue item')
      }

      const provider = await getEmailProvider(item.emailAccountId)
      const result = await provider.send({
        from: item.fromAddress,
        fromName: item.fromName || undefined,
        to: item.toAddress,
        subject: item.subject,
        html: htmlBody,
        text: item.textBody || undefined,
        replyTo: item.replyTo || undefined,
        headers: { ...(item.headers as Record<string, string> || {}), ...additionalHeaders },
        campaignSendId: item.campaignSendId || undefined,
      })

      // Mark as sent
      await db
        .update(emailQueue)
        .set({
          status: 'sent',
          providerMessageId: result.providerMessageId,
          sentAt: result.acceptedAt,
          updatedAt: new Date(),
        })
        .where(eq(emailQueue.id, item.id))

      // Update campaign send status
      if (item.campaignSendId) {
        await db
          .update(campaignSends)
          .set({
            status: 'sent',
            providerMessageId: result.providerMessageId,
            sentAt: result.acceptedAt,
            updatedAt: new Date(),
          })
          .where(eq(campaignSends.id, item.campaignSendId))

        // Increment campaign totalSent
        const [send] = await db
          .select({ campaignId: campaignSends.campaignId })
          .from(campaignSends)
          .where(eq(campaignSends.id, item.campaignSendId))
          .limit(1)

        if (send) {
          await db
            .update(campaigns)
            .set({
              totalSent: sql`${campaigns.totalSent} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(campaigns.id, send.campaignId))
        }
      }

      // Update email account last used
      if (item.emailAccountId) {
        await db
          .update(emailAccounts)
          .set({ lastUsedAt: new Date() })
          .where(eq(emailAccounts.id, item.emailAccountId))
      }

      succeeded++
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      const isRateLimit = errorMsg.includes('429') || errorMsg.toLowerCase().includes('rate limit')
      const attempts = (item.attempts || 0) + 1
      const maxAttempts = item.maxAttempts || 3

      if (isRateLimit) {
        // Rate limited - retry after 30 minutes
        await db
          .update(emailQueue)
          .set({
            status: 'pending',
            attempts,
            lastError: 'Rate limited (429)',
            nextAttemptAt: new Date(Date.now() + 30 * 60 * 1000),
            updatedAt: new Date(),
          })
          .where(eq(emailQueue.id, item.id))
      } else if (attempts >= maxAttempts) {
        // Max retries reached
        await db
          .update(emailQueue)
          .set({
            status: 'failed',
            attempts,
            lastError: errorMsg,
            updatedAt: new Date(),
          })
          .where(eq(emailQueue.id, item.id))

        // Mark campaign send as failed
        if (item.campaignSendId) {
          await db
            .update(campaignSends)
            .set({
              status: 'failed',
              errorMessage: errorMsg,
              updatedAt: new Date(),
            })
            .where(eq(campaignSends.id, item.campaignSendId))
        }
      } else {
        // Transient error - exponential backoff
        const backoffMs = Math.pow(2, attempts) * 60 * 1000
        await db
          .update(emailQueue)
          .set({
            status: 'pending',
            attempts,
            lastError: errorMsg,
            nextAttemptAt: new Date(Date.now() + backoffMs),
            updatedAt: new Date(),
          })
          .where(eq(emailQueue.id, item.id))
      }

      failed++
    }
  }

  // Count remaining
  const [remainingCount] = await db
    .select({ count: count() })
    .from(emailQueue)
    .where(eq(emailQueue.status, 'pending'))

  return {
    processed: items.length,
    succeeded,
    failed,
    remaining: remainingCount?.count ?? 0,
  }
}

/**
 * Process email batch for a specific company.
 */
export async function processEmailBatchForCompany(
  companyId: string,
  batchSize: number = 50
): Promise<{
  processed: number
  succeeded: number
  failed: number
  remaining: number
}> {
  const now = new Date()

  const items = await db
    .select()
    .from(emailQueue)
    .where(and(
      eq(emailQueue.companyId, companyId),
      eq(emailQueue.status, 'pending'),
      lte(emailQueue.nextAttemptAt, now),
      sql`(${emailQueue.scheduledFor} IS NULL OR ${emailQueue.scheduledFor} <= ${now})`
    ))
    .orderBy(asc(emailQueue.priority), asc(emailQueue.nextAttemptAt))
    .limit(batchSize)

  // Reuse same processing logic - process items one by one
  let succeeded = 0
  let failed = 0

  for (const item of items) {
    await db
      .update(emailQueue)
      .set({ status: 'in_progress', lastAttemptAt: now, updatedAt: now })
      .where(eq(emailQueue.id, item.id))

    try {
      // Check suppression
      const [suppression] = await db
        .select({ id: emailSuppressions.id })
        .from(emailSuppressions)
        .where(and(
          eq(emailSuppressions.companyId, item.companyId),
          eq(emailSuppressions.email, item.toAddress.toLowerCase())
        ))
        .limit(1)

      if (suppression) {
        await db
          .update(emailQueue)
          .set({ status: 'cancelled', lastError: 'Recipient is suppressed', updatedAt: new Date() })
          .where(eq(emailQueue.id, item.id))
        continue
      }

      let htmlBody = item.htmlBody
      let additionalHeaders: Record<string, string> = {}

      if (item.campaignSendId) {
        htmlBody = injectTracking({ html: htmlBody, campaignSendId: item.campaignSendId })
        const unsub = injectUnsubscribe({
          html: htmlBody,
          campaignSendId: item.campaignSendId,
          companyId: item.companyId,
        })
        htmlBody = unsub.html
        additionalHeaders = unsub.headers
      }

      if (!item.emailAccountId) throw new Error('No email account ID')

      const provider = await getEmailProvider(item.emailAccountId)
      const result = await provider.send({
        from: item.fromAddress,
        fromName: item.fromName || undefined,
        to: item.toAddress,
        subject: item.subject,
        html: htmlBody,
        text: item.textBody || undefined,
        replyTo: item.replyTo || undefined,
        headers: { ...(item.headers as Record<string, string> || {}), ...additionalHeaders },
        campaignSendId: item.campaignSendId || undefined,
      })

      await db
        .update(emailQueue)
        .set({
          status: 'sent',
          providerMessageId: result.providerMessageId,
          sentAt: result.acceptedAt,
          updatedAt: new Date(),
        })
        .where(eq(emailQueue.id, item.id))

      if (item.campaignSendId) {
        await db
          .update(campaignSends)
          .set({
            status: 'sent',
            providerMessageId: result.providerMessageId,
            sentAt: result.acceptedAt,
            updatedAt: new Date(),
          })
          .where(eq(campaignSends.id, item.campaignSendId))

        const [send] = await db
          .select({ campaignId: campaignSends.campaignId })
          .from(campaignSends)
          .where(eq(campaignSends.id, item.campaignSendId))
          .limit(1)

        if (send) {
          await db
            .update(campaigns)
            .set({ totalSent: sql`${campaigns.totalSent} + 1`, updatedAt: new Date() })
            .where(eq(campaigns.id, send.campaignId))
        }
      }

      succeeded++
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      const attempts = (item.attempts || 0) + 1
      const maxAttempts = item.maxAttempts || 3

      if (attempts >= maxAttempts) {
        await db
          .update(emailQueue)
          .set({ status: 'failed', attempts, lastError: errorMsg, updatedAt: new Date() })
          .where(eq(emailQueue.id, item.id))
        if (item.campaignSendId) {
          await db
            .update(campaignSends)
            .set({ status: 'failed', errorMessage: errorMsg, updatedAt: new Date() })
            .where(eq(campaignSends.id, item.campaignSendId))
        }
      } else {
        const backoffMs = Math.pow(2, attempts) * 60 * 1000
        await db
          .update(emailQueue)
          .set({
            status: 'pending',
            attempts,
            lastError: errorMsg,
            nextAttemptAt: new Date(Date.now() + backoffMs),
            updatedAt: new Date(),
          })
          .where(eq(emailQueue.id, item.id))
      }
      failed++
    }
  }

  const [remainingCount] = await db
    .select({ count: count() })
    .from(emailQueue)
    .where(and(eq(emailQueue.companyId, companyId), eq(emailQueue.status, 'pending')))

  return {
    processed: items.length,
    succeeded,
    failed,
    remaining: remainingCount?.count ?? 0,
  }
}
