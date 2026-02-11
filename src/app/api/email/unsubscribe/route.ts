import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emailSuppressions, campaignSends, candidates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('api:email:unsubscribe')

async function addSuppression(companyId: string, email: string, source: string) {
  try {
    await db
      .insert(emailSuppressions)
      .values({
        companyId,
        email: email.toLowerCase(),
        reason: 'unsubscribe',
        source,
      })
      .onConflictDoNothing()
  } catch (error) {
    logger.error({ message: 'Error adding suppression', error })
  }
}

// GET: Show unsubscribe confirmation page
export async function GET(request: NextRequest) {
  const sid = request.nextUrl.searchParams.get('sid')
  const cid = request.nextUrl.searchParams.get('cid')

  if (!sid || !cid) {
    return new Response('Invalid unsubscribe link', { status: 400 })
  }

  // Look up the email from the campaign send
  const [send] = await db
    .select({
      id: campaignSends.id,
      candidateId: campaignSends.candidateId,
    })
    .from(campaignSends)
    .where(eq(campaignSends.id, sid))
    .limit(1)

  if (!send) {
    return new Response('Invalid unsubscribe link', { status: 400 })
  }

  const [candidate] = await db
    .select({ email: candidates.email })
    .from(candidates)
    .where(eq(candidates.id, send.candidateId))
    .limit(1)

  if (candidate?.email) {
    await addSuppression(cid, candidate.email, sid)
  }

  const html = `<!DOCTYPE html>
<html>
<head><title>Unsubscribed</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
  .card { background: white; padding: 48px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
  h1 { font-size: 24px; margin: 0 0 12px; color: #111; }
  p { font-size: 15px; color: #666; margin: 0; line-height: 1.5; }
</style>
</head>
<body>
  <div class="card">
    <h1>You've been unsubscribed</h1>
    <p>You will no longer receive campaign emails from this sender. This may take a few minutes to take effect.</p>
  </div>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  })
}

// POST: Handle List-Unsubscribe-Post one-click unsubscribe
async function _POST(request: NextRequest) {
  const sid = request.nextUrl.searchParams.get('sid')
  const cid = request.nextUrl.searchParams.get('cid')

  if (!sid || !cid) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  const [send] = await db
    .select({ candidateId: campaignSends.candidateId })
    .from(campaignSends)
    .where(eq(campaignSends.id, sid))
    .limit(1)

  if (!send) {
    return NextResponse.json({ error: 'Invalid send ID' }, { status: 400 })
  }

  const [candidate] = await db
    .select({ email: candidates.email })
    .from(candidates)
    .where(eq(candidates.id, send.candidateId))
    .limit(1)

  if (candidate?.email) {
    await addSuppression(cid, candidate.email, sid)
  }

  return NextResponse.json({ success: true })
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
