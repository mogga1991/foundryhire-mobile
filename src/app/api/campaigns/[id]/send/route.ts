import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { campaigns, campaignSends, candidates, emailAccounts, emailSuppressions, emailQueue, companies, jobs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { renderTemplate } from '@/lib/email/template'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const { companyId } = await requireCompanyAccess()

    // Fetch campaign
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.companyId, companyId)))
      .limit(1)

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status !== 'draft' && campaign.status !== 'paused') {
      return NextResponse.json(
        { error: 'Campaign can only be launched from draft or paused status' },
        { status: 400 }
      )
    }

    // Resolve email account
    let emailAccountId = campaign.emailAccountId
    let fromAddress: string
    let fromName: string | null = null

    if (emailAccountId) {
      const [account] = await db
        .select()
        .from(emailAccounts)
        .where(and(eq(emailAccounts.id, emailAccountId), eq(emailAccounts.status, 'active')))
        .limit(1)
      if (!account) {
        return NextResponse.json({ error: 'Email account not found or inactive' }, { status: 400 })
      }
      fromAddress = account.fromAddress
      fromName = account.fromName
    } else {
      // Try default account, then first active ESP account
      const [defaultAccount] = await db
        .select()
        .from(emailAccounts)
        .where(and(
          eq(emailAccounts.companyId, companyId),
          eq(emailAccounts.isDefault, true),
          eq(emailAccounts.status, 'active')
        ))
        .limit(1)

      const account = defaultAccount ?? (await db
        .select()
        .from(emailAccounts)
        .where(and(
          eq(emailAccounts.companyId, companyId),
          eq(emailAccounts.type, 'esp'),
          eq(emailAccounts.status, 'active')
        ))
        .limit(1)
      )[0]

      if (!account) {
        return NextResponse.json(
          { error: 'No active email account found. Please set up an email account in Settings.' },
          { status: 400 }
        )
      }
      emailAccountId = account.id
      fromAddress = account.fromAddress
      fromName = account.fromName
    }

    // Fetch pending sends with candidate data
    const pendingSends = await db
      .select({
        sendId: campaignSends.id,
        candidateEmail: candidates.email,
        candidateFirstName: candidates.firstName,
        candidateLastName: candidates.lastName,
        candidateCurrentCompany: candidates.currentCompany,
        candidateCurrentTitle: candidates.currentTitle,
        candidateLocation: candidates.location,
      })
      .from(campaignSends)
      .innerJoin(candidates, eq(campaignSends.candidateId, candidates.id))
      .where(and(
        eq(campaignSends.campaignId, campaignId),
        eq(campaignSends.status, 'pending')
      ))

    if (!pendingSends.length) {
      return NextResponse.json(
        { error: 'No pending sends found for this campaign' },
        { status: 400 }
      )
    }

    // Get company and job info for template rendering
    const [company] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1)

    let jobTitle = ''
    if (campaign.jobId) {
      const [job] = await db
        .select({ title: jobs.title })
        .from(jobs)
        .where(eq(jobs.id, campaign.jobId))
        .limit(1)
      jobTitle = job?.title ?? ''
    }

    // Get suppression list
    const suppressions = await db
      .select({ email: emailSuppressions.email })
      .from(emailSuppressions)
      .where(eq(emailSuppressions.companyId, companyId))

    const suppressedEmails = new Set(suppressions.map(s => s.email.toLowerCase()))

    const now = new Date()
    let queued = 0
    let skipped = 0
    const queueItems: Array<{
      companyId: string
      emailAccountId: string
      campaignSendId: string
      fromAddress: string
      fromName: string | null
      toAddress: string
      subject: string
      htmlBody: string
    }> = []

    for (const send of pendingSends) {
      if (!send.candidateEmail) {
        skipped++
        continue
      }

      if (suppressedEmails.has(send.candidateEmail.toLowerCase())) {
        await db
          .update(campaignSends)
          .set({ status: 'cancelled', errorMessage: 'Email suppressed', updatedAt: now })
          .where(eq(campaignSends.id, send.sendId))
        skipped++
        continue
      }

      const context = {
        firstName: send.candidateFirstName || '',
        lastName: send.candidateLastName || '',
        fullName: `${send.candidateFirstName || ''} ${send.candidateLastName || ''}`.trim(),
        email: send.candidateEmail,
        currentCompany: send.candidateCurrentCompany || '',
        currentTitle: send.candidateCurrentTitle || '',
        location: send.candidateLocation || '',
        jobTitle,
        companyName: company?.name || '',
        senderName: fromName || '',
      }

      queueItems.push({
        companyId,
        emailAccountId: emailAccountId!,
        campaignSendId: send.sendId,
        fromAddress,
        fromName,
        toAddress: send.candidateEmail,
        subject: renderTemplate(campaign.subject, context),
        htmlBody: renderTemplate(campaign.body, context),
      })
      queued++
    }

    // Batch insert into email queue
    if (queueItems.length > 0) {
      await db.insert(emailQueue).values(queueItems)

      // Update campaign sends to 'queued' status
      for (const item of queueItems) {
        await db
          .update(campaignSends)
          .set({ status: 'queued', updatedAt: now })
          .where(eq(campaignSends.id, item.campaignSendId))
      }
    }

    // Update campaign status
    const [updatedCampaign] = await db
      .update(campaigns)
      .set({
        status: 'active',
        sentAt: now,
        emailAccountId,
        updatedAt: now,
      })
      .where(eq(campaigns.id, campaignId))
      .returning()

    return NextResponse.json({
      data: updatedCampaign,
      message: `Campaign launched. ${queued} emails queued for delivery.${skipped > 0 ? ` ${skipped} skipped (no email or suppressed).` : ''}`,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
