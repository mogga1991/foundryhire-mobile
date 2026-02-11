import { NextRequest } from 'next/server'
import { createLogger } from '@/lib/logger'
import { db } from '@/lib/db'
import { campaignSends, campaigns } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'

const logger = createLogger('api:track:open')

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

const GIF_RESPONSE_HEADERS = {
  'Content-Type': 'image/gif',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

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
    logger.error({ message: 'Track open event failed', error })
  }
}

// Intentionally public endpoint (email tracking pixel)
// Rate limited to prevent abuse
export async function GET(request: NextRequest) {
  // Rate limit: 100 opens per minute per IP to prevent abuse
  const rateLimitResult = await rateLimit(request, {
    limit: 100,
    window: 60000,
    identifier: (req) => `track-open:${getIpIdentifier(req)}`,
  })

  // Always return the transparent GIF even on rate limit
  if (rateLimitResult) {
    return new Response(TRANSPARENT_GIF, { headers: GIF_RESPONSE_HEADERS })
  }

  const sid = request.nextUrl.searchParams.get('sid')

  if (sid) {
    // Fire-and-forget for fast response
    updateOpenEvent(sid).catch(() => {})
  }

  return new Response(TRANSPARENT_GIF, { headers: GIF_RESPONSE_HEADERS })
}
