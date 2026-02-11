import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'
import { db } from '@/lib/db'
import { campaignSends, campaigns } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'

const logger = createLogger('api:track:click')

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
    logger.error({ message: 'Track click event failed', error })
  }
}

// Intentionally public endpoint (email tracking link redirect)
// Rate limited to prevent abuse
export async function GET(request: NextRequest) {
  // Rate limit: 100 clicks per minute per IP to prevent abuse
  const rateLimitResult = await rateLimit(request, {
    limit: 100,
    window: 60000,
    identifier: (req) => `track-click:${getIpIdentifier(req)}`,
  })

  if (rateLimitResult) {
    // On rate limit, still redirect but don't track
    const url = request.nextUrl.searchParams.get('url')
    if (url) {
      return NextResponse.redirect(decodeURIComponent(url))
    }
    return NextResponse.redirect(env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
  }

  const sid = request.nextUrl.searchParams.get('sid')
  const url = request.nextUrl.searchParams.get('url')

  if (sid) {
    updateClickEvent(sid).catch(() => {})
  }

  if (!url) {
    return NextResponse.redirect(env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
  }

  return NextResponse.redirect(decodeURIComponent(url))
}
