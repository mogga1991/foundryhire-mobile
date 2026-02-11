/**
 * Follow-Up Scheduler Service
 *
 * Checks active campaigns for follow-up emails that need to be scheduled.
 * Follow-ups are sent to candidates who received the initial email but
 * haven't replied or bounced within the specified delay period.
 */

import { db } from '@/lib/db'
import { campaigns, campaignFollowUps, campaignSends, candidates, emailAccounts, emailQueue, emailSuppressions } from '@/lib/db/schema'
import { eq, and, isNull, lte, sql } from 'drizzle-orm'
import { renderTemplate } from '@/lib/email/template'

/**
 * Schedule follow-ups for a single campaign.
 */
export async function scheduleFollowUps(campaignId: string): Promise<number> {
  // Get campaign details
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.status, 'active')))
    .limit(1)

  if (!campaign || !campaign.emailAccountId) return 0

  // Get follow-up definitions
  const followUps = await db
    .select()
    .from(campaignFollowUps)
    .where(and(
      eq(campaignFollowUps.campaignId, campaignId),
      eq(campaignFollowUps.status, 'active')
    ))

  if (!followUps.length) return 0

  // Get email account details
  const [emailAccount] = await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.id, campaign.emailAccountId))
    .limit(1)

  if (!emailAccount || emailAccount.status !== 'active') return 0

  let scheduled = 0

  for (const followUp of followUps) {
    // Find sends that are eligible for this follow-up step:
    // - Original send was delivered/sent
    // - Not bounced or replied
    // - Enough time has passed (delayDays from sentAt)
    // - No follow-up has already been scheduled for this step
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - followUp.delayDays)

    const eligibleSends = await db
      .select({
        sendId: campaignSends.id,
        candidateId: campaignSends.candidateId,
        sentAt: campaignSends.sentAt,
      })
      .from(campaignSends)
      .where(and(
        eq(campaignSends.campaignId, campaignId),
        eq(campaignSends.followUpStep, 0), // Only check initial sends
        sql`${campaignSends.status} IN ('sent', 'delivered', 'opened', 'clicked')`,
        isNull(campaignSends.repliedAt),
        isNull(campaignSends.bouncedAt),
        lte(campaignSends.sentAt, cutoffDate)
      ))

    for (const send of eligibleSends) {
      // Check if follow-up already exists for this candidate + step
      const [existingFollowUp] = await db
        .select({ id: campaignSends.id })
        .from(campaignSends)
        .where(and(
          eq(campaignSends.campaignId, campaignId),
          eq(campaignSends.candidateId, send.candidateId),
          eq(campaignSends.followUpStep, followUp.stepNumber)
        ))
        .limit(1)

      if (existingFollowUp) continue

      // Get candidate data for template rendering
      const [candidate] = await db
        .select()
        .from(candidates)
        .where(eq(candidates.id, send.candidateId))
        .limit(1)

      if (!candidate?.email) continue

      // Check suppression
      const [suppressed] = await db
        .select({ id: emailSuppressions.id })
        .from(emailSuppressions)
        .where(and(
          eq(emailSuppressions.companyId, campaign.companyId),
          eq(emailSuppressions.email, candidate.email.toLowerCase())
        ))
        .limit(1)

      if (suppressed) continue

      const context = {
        firstName: candidate.firstName || '',
        lastName: candidate.lastName || '',
        fullName: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
        email: candidate.email,
        currentCompany: candidate.currentCompany || '',
        currentTitle: candidate.currentTitle || '',
        location: candidate.location || '',
        jobTitle: '',
        companyName: '',
        senderName: emailAccount.fromName || '',
      }

      const renderedSubject = renderTemplate(followUp.subject, context)
      const renderedBody = renderTemplate(followUp.body, context)

      // Create a campaign send record for the follow-up
      const [followUpSend] = await db
        .insert(campaignSends)
        .values({
          campaignId,
          candidateId: send.candidateId,
          status: 'queued',
          followUpStep: followUp.stepNumber,
        })
        .returning()

      // Queue the email
      await db
        .insert(emailQueue)
        .values({
          companyId: campaign.companyId,
          emailAccountId: campaign.emailAccountId!,
          campaignSendId: followUpSend.id,
          fromAddress: emailAccount.fromAddress,
          fromName: emailAccount.fromName,
          toAddress: candidate.email,
          subject: renderedSubject,
          htmlBody: renderedBody,
        })

      scheduled++
    }
  }

  return scheduled
}

/**
 * Check all active campaigns and schedule follow-ups.
 * Called by cron job.
 */
export async function checkAndScheduleFollowUps(): Promise<{
  campaignsChecked: number
  followUpsScheduled: number
}> {
  // Get all active campaigns that have follow-ups
  const activeCampaigns = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.status, 'active'))

  let totalScheduled = 0

  for (const campaign of activeCampaigns) {
    // Check if this campaign has follow-ups defined
    const [hasFollowUps] = await db
      .select({ id: campaignFollowUps.id })
      .from(campaignFollowUps)
      .where(eq(campaignFollowUps.campaignId, campaign.id))
      .limit(1)

    if (!hasFollowUps) continue

    const scheduled = await scheduleFollowUps(campaign.id)
    totalScheduled += scheduled
  }

  return {
    campaignsChecked: activeCampaigns.length,
    followUpsScheduled: totalScheduled,
  }
}
