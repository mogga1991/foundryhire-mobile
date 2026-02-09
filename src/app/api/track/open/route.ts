import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { campaignSends, campaigns } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

async function updateOpenEvent(campaignSendId: string) {
  try {
    // Only set openedAt if not already set (first open wins)
    const [send] = await db
      .select({ id: campaignSends.id, openedAt: campaignSends.openedAt, campaignId: campaignSends.campaignId })
      .from(campaignSends)
      .where(eq(campaignSends.id, campaignSendId))
      .limit(1)

    if (!send || send.openedAt) return

    await db
      .update(campaignSends)
      .set({ openedAt: new Date(), status: 'opened', updatedAt: new Date() })
      .where(eq(campaignSends.id, campaignSendId))

    await db
      .update(campaigns)
      .set({ totalOpened: sql`${campaigns.totalOpened} + 1`, updatedAt: new Date() })
      .where(eq(campaigns.id, send.campaignId))
  } catch (error) {
    console.error('[Track Open] Error:', error)
  }
}

export async function GET(request: NextRequest) {
  const sid = request.nextUrl.searchParams.get('sid')

  if (sid) {
    // Fire-and-forget for fast response
    updateOpenEvent(sid).catch(() => {})
  }

  return new Response(TRANSPARENT_GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}
