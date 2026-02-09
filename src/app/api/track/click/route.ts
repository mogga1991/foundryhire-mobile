import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { campaignSends, campaigns } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

async function updateClickEvent(campaignSendId: string) {
  try {
    const [send] = await db
      .select({ id: campaignSends.id, clickedAt: campaignSends.clickedAt, campaignId: campaignSends.campaignId })
      .from(campaignSends)
      .where(eq(campaignSends.id, campaignSendId))
      .limit(1)

    if (!send || send.clickedAt) return

    await db
      .update(campaignSends)
      .set({ clickedAt: new Date(), status: 'clicked', updatedAt: new Date() })
      .where(eq(campaignSends.id, campaignSendId))

    await db
      .update(campaigns)
      .set({ totalClicked: sql`${campaigns.totalClicked} + 1`, updatedAt: new Date() })
      .where(eq(campaigns.id, send.campaignId))
  } catch (error) {
    console.error('[Track Click] Error:', error)
  }
}

export async function GET(request: NextRequest) {
  const sid = request.nextUrl.searchParams.get('sid')
  const url = request.nextUrl.searchParams.get('url')

  if (sid) {
    updateClickEvent(sid).catch(() => {})
  }

  if (!url) {
    return NextResponse.redirect(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
  }

  return NextResponse.redirect(decodeURIComponent(url))
}
