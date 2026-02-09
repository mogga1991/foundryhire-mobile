import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { campaigns, campaignSends } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const { companyId } = await requireCompanyAccess()

    // Verify campaign belongs to this company
    const [campaign] = await db
      .select({
        id: campaigns.id,
        totalRecipients: campaigns.totalRecipients,
        totalSent: campaigns.totalSent,
        totalOpened: campaigns.totalOpened,
        totalClicked: campaigns.totalClicked,
        totalReplied: campaigns.totalReplied,
        status: campaigns.status,
      })
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.companyId, companyId)))
      .limit(1)

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Compute live stats from sends
    const sends = await db
      .select({
        status: campaignSends.status,
        sentAt: campaignSends.sentAt,
        openedAt: campaignSends.openedAt,
        clickedAt: campaignSends.clickedAt,
        repliedAt: campaignSends.repliedAt,
        bouncedAt: campaignSends.bouncedAt,
      })
      .from(campaignSends)
      .where(eq(campaignSends.campaignId, campaignId))

    const liveStats = {
      total_recipients: sends.length,
      total_sent: sends.filter((s) => s.sentAt !== null).length,
      total_opened: sends.filter((s) => s.openedAt !== null).length,
      total_clicked: sends.filter((s) => s.clickedAt !== null).length,
      total_replied: sends.filter((s) => s.repliedAt !== null).length,
      total_bounced: sends.filter((s) => s.bouncedAt !== null).length,
      total_pending: sends.filter((s) => s.status === 'pending').length,
    }

    const totalBase = liveStats.total_sent > 0 ? liveStats.total_sent : liveStats.total_recipients
    const rates = {
      open_rate: totalBase > 0 ? Math.round((liveStats.total_opened / totalBase) * 100) : 0,
      click_rate: totalBase > 0 ? Math.round((liveStats.total_clicked / totalBase) * 100) : 0,
      reply_rate: totalBase > 0 ? Math.round((liveStats.total_replied / totalBase) * 100) : 0,
      bounce_rate: totalBase > 0 ? Math.round((liveStats.total_bounced / totalBase) * 100) : 0,
    }

    return NextResponse.json({
      data: {
        campaign_id: campaignId,
        status: campaign.status,
        ...liveStats,
        ...rates,
      },
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
