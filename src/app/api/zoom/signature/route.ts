import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { generateZoomSignature } from '@/lib/integrations/zoom'
import { db } from '@/lib/db'
import { interviews, companyUsers } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { rateLimit, RateLimitPresets, getUserIdentifier, getIpIdentifier } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('api:zoom:signature')

// Zod validation schema for the request
const signatureRequestSchema = z.object({
  meetingNumber: z.string().min(1, 'Meeting number is required').regex(/^\d+$/, 'Meeting number must be numeric'),
  role: z.union([z.literal(0), z.literal(1)], {
    message: 'Role must be 0 (participant) or 1 (host)'
  })
})

/**
 * POST /api/zoom/signature
 *
 * Generate a Zoom SDK signature for embedding meetings in the browser
 *
 * Authentication:
 * - Session-based auth (for authenticated users)
 * - OR Bearer token auth (for candidate portal access)
 *
 * Body: { meetingNumber: string, role: 0 | 1 }
 * - meetingNumber: The Zoom meeting ID
 * - role: 0 for participant, 1 for host
 *
 * Returns: { signature: string }
 */
async function _POST(request: NextRequest) {
  try {
    // Parse and validate request body first
    const body = await request.json()
    const validationResult = signatureRequestSchema.safeParse(body)

    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(e => e.message).join(', ')
      return NextResponse.json(
        { error: errors },
        { status: 400 }
      )
    }

    const { meetingNumber, role } = validationResult.data

    // Check for session-based auth first
    const session = await getSession()

    if (session) {
      // Authenticated user path - apply user-based rate limiting
      const rateLimitResult = await rateLimit(request, {
        ...RateLimitPresets.standard, // 30 requests per minute
        identifier: () => getUserIdentifier(session.user.id),
      })
      if (rateLimitResult) return rateLimitResult

      // Get user's company
      const [companyUser] = await db
        .select()
        .from(companyUsers)
        .where(eq(companyUsers.userId, session.user.id))
        .limit(1)

      if (!companyUser) {
        return NextResponse.json(
          { error: 'No company found for user' },
          { status: 400 }
        )
      }

      // Verify meeting exists and belongs to user's company
      const [interview] = await db
        .select({
          id: interviews.id,
          status: interviews.status,
          companyId: interviews.companyId,
        })
        .from(interviews)
        .where(eq(interviews.zoomMeetingId, meetingNumber))
        .limit(1)

      if (!interview) {
        return NextResponse.json(
          { error: 'Meeting not found' },
          { status: 404 }
        )
      }

      if (interview.status === 'cancelled') {
        return NextResponse.json(
          { error: 'Meeting has been cancelled' },
          { status: 410 }
        )
      }

      if (interview.companyId !== companyUser.companyId) {
        return NextResponse.json(
          { error: 'Access denied to this meeting' },
          { status: 403 }
        )
      }

      // Generate signature for authenticated user
      const signature = generateZoomSignature(meetingNumber, role)
      logger.info({ message: 'Generated signature for authenticated user', userId: session.user.id, meetingNumber, role })

      return NextResponse.json({ signature })
    }

    // No session - check for candidate portal token authentication
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const portalToken = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Apply IP-based rate limiting for portal access
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.standard, // 30 requests per minute
      identifier: (req) => getIpIdentifier(req),
    })
    if (rateLimitResult) return rateLimitResult

    // Validate portal token - must match both token and meeting ID, and not be expired
    const [interview] = await db
      .select({
        id: interviews.id,
        status: interviews.status,
        candidatePortalExpiresAt: interviews.candidatePortalExpiresAt,
      })
      .from(interviews)
      .where(
        and(
          eq(interviews.candidatePortalToken, portalToken),
          eq(interviews.zoomMeetingId, meetingNumber),
          gt(interviews.candidatePortalExpiresAt, new Date())
        )
      )
      .limit(1)

    if (!interview) {
      return NextResponse.json(
        { error: 'Invalid or expired portal token' },
        { status: 401 }
      )
    }

    if (interview.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Meeting has been cancelled' },
        { status: 410 }
      )
    }

    // Candidates can ONLY request role 0 (participant)
    if (role !== 0) {
      return NextResponse.json(
        { error: 'Candidates can only join as participants (role 0)' },
        { status: 403 }
      )
    }

    // Generate signature for candidate
    const signature = generateZoomSignature(meetingNumber, role)
    logger.info({ message: 'Generated signature for candidate via portal token', meetingNumber, role })

    return NextResponse.json({ signature })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ message: 'Error generating Zoom signature', error })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate signature' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
