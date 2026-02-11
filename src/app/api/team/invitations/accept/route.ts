import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { teamInvitations, teamMembers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('team-invitations')

const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Token is required').max(255),
})

// POST /api/team/invitations/accept — Accept a team invitation
async function _POST(request: NextRequest) {
  try {
    // Rate limit: 10/min
    const rateLimitResult = await rateLimit(request, {
      limit: 10,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })
    if (rateLimitResult) return rateLimitResult

    const user = await requireAuth()

    const body = await request.json()
    const validation = acceptInvitationSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.issues.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      )
    }

    const { token } = validation.data

    // Find the invitation
    const [invitation] = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.token, token))
      .limit(1)

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 404 }
      )
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: 'Invitation already accepted' },
        { status: 409 }
      )
    }

    // Check expiry
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 410 }
      )
    }

    // Verify the user's email matches the invitation
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invitation was sent to a different email address' },
        { status: 403 }
      )
    }

    // Update or create the team member record
    const [existingMember] = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.companyId, invitation.companyId),
          eq(teamMembers.email, invitation.email)
        )
      )
      .limit(1)

    let member
    const now = new Date()

    if (existingMember) {
      // Update existing record
      const [updated] = await db
        .update(teamMembers)
        .set({
          userId: user.id,
          role: invitation.role,
          status: 'active',
          joinedAt: now,
          lastActiveAt: now,
          updatedAt: now,
        })
        .where(eq(teamMembers.id, existingMember.id))
        .returning()
      member = updated
    } else {
      // Create new record
      const [created] = await db.insert(teamMembers).values({
        companyId: invitation.companyId,
        userId: user.id,
        email: invitation.email,
        firstName: user.name?.split(' ')[0] || null,
        lastName: user.name?.split(' ').slice(1).join(' ') || null,
        role: invitation.role,
        status: 'active',
        invitedBy: invitation.invitedBy,
        invitedAt: invitation.createdAt,
        joinedAt: now,
        lastActiveAt: now,
      }).returning()
      member = created
    }

    // Mark invitation as accepted
    await db
      .update(teamInvitations)
      .set({ acceptedAt: now })
      .where(eq(teamInvitations.id, invitation.id))

    logger.info({
      message: 'Team invitation accepted',
      companyId: invitation.companyId,
      userId: user.id,
      email: invitation.email,
      role: invitation.role,
    })

    return NextResponse.json({ member })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ message: 'Error accepting team invitation', error })

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Failed to accept invitation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
