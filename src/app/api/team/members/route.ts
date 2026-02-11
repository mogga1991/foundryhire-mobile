import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { teamMembers, teamInvitations } from '@/lib/db/schema'
import { eq, and, or, ilike, sql, desc } from 'drizzle-orm'
import { z } from 'zod'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { sanitizeUserInput } from '@/lib/security/sanitize'
import { createLogger } from '@/lib/logger'
import { isRoleAtLeast, type TeamRole } from '@/lib/auth/permissions'
import { notifyTeamInvite } from '@/lib/services/notifications'
import crypto from 'crypto'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { escapeLikePattern } from '@/lib/utils/sql-escape'

const logger = createLogger('team-members')

// Zod schema for inviting a new team member
const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  role: z.enum(['admin', 'recruiter', 'interviewer', 'viewer']),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
})

// POST /api/team/members — Invite a new team member
async function _POST(request: NextRequest) {
  try {
    // Rate limit: 10/min
    const rateLimitResult = await rateLimit(request, {
      limit: 10,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })
    if (rateLimitResult) return rateLimitResult

    const { user, companyId, role: callerRole } = await requireCompanyAccess()

    // Only owner/admin can invite
    if (!isRoleAtLeast(callerRole as TeamRole, 'admin')) {
      return NextResponse.json(
        { error: 'Forbidden', details: 'Only owners and admins can invite team members' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = inviteMemberSchema.safeParse(body)

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

    let { email, role, firstName, lastName } = validation.data

    // Sanitize inputs
    email = sanitizeUserInput(email, { maxLength: 255, allowNewlines: false }).toLowerCase()
    if (firstName) firstName = sanitizeUserInput(firstName, { maxLength: 100, allowNewlines: false })
    if (lastName) lastName = sanitizeUserInput(lastName, { maxLength: 100, allowNewlines: false })

    // Only owner can invite admins
    if (role === 'admin' && callerRole !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden', details: 'Only the owner can invite admin members' },
        { status: 403 }
      )
    }

    // Check if member already exists for this company
    const [existingMember] = await db
      .select({ id: teamMembers.id, status: teamMembers.status })
      .from(teamMembers)
      .where(and(eq(teamMembers.companyId, companyId), eq(teamMembers.email, email)))
      .limit(1)

    if (existingMember) {
      if (existingMember.status === 'active') {
        return NextResponse.json(
          { error: 'Conflict', details: 'This email is already an active team member' },
          { status: 409 }
        )
      }
      if (existingMember.status === 'invited') {
        return NextResponse.json(
          { error: 'Conflict', details: 'An invitation has already been sent to this email' },
          { status: 409 }
        )
      }
    }

    // Generate a secure invitation token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 day expiry

    // Create team member record (status: invited)
    const [member] = await db.insert(teamMembers).values({
      companyId,
      email,
      firstName: firstName || null,
      lastName: lastName || null,
      role,
      status: 'invited',
      invitedBy: user.id,
      invitedAt: new Date(),
    }).returning()

    // Create invitation record
    const [invitation] = await db.insert(teamInvitations).values({
      companyId,
      email,
      role,
      token,
      expiresAt,
      invitedBy: user.id,
    }).returning()

    logger.info({ message: 'Team member invited', companyId, email, role, invitedBy: user.id })

    // Send notification (non-blocking)
    notifyTeamInvite(companyId, email, user.id).catch((err) => {
      logger.error({ message: 'Failed to send team invite notification', error: err })
    })

    return NextResponse.json(
      {
        member,
        invitation: {
          id: invitation.id,
          token: invitation.token,
          expiresAt: invitation.expiresAt,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ message: 'Error inviting team member', error })

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Failed to invite team member', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET /api/team/members — List team members
async function _GET(request: NextRequest) {
  try {
    // Rate limit: 30/min
    const rateLimitResult = await rateLimit(request, {
      limit: 30,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })
    if (rateLimitResult) return rateLimitResult

    const { companyId } = await requireCompanyAccess()
    const url = new URL(request.url)

    const search = url.searchParams.get('search')
    const status = url.searchParams.get('status')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    // Build where conditions
    const conditions = [eq(teamMembers.companyId, companyId)]

    if (status) {
      const validStatuses = ['active', 'invited', 'deactivated']
      if (validStatuses.includes(status)) {
        conditions.push(eq(teamMembers.status, status))
      }
    } else {
      // By default, exclude deactivated
      conditions.push(
        or(eq(teamMembers.status, 'active'), eq(teamMembers.status, 'invited'))!
      )
    }

    if (search) {
      const escapedSearch = escapeLikePattern(search)
      const searchTerm = `%${escapedSearch}%`
      conditions.push(
        or(
          ilike(teamMembers.firstName, searchTerm),
          ilike(teamMembers.lastName, searchTerm),
          ilike(teamMembers.email, searchTerm),
          sql`CONCAT(${teamMembers.firstName}, ' ', ${teamMembers.lastName}) ILIKE ${searchTerm}`
        )!
      )
    }

    // Count total
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(teamMembers)
      .where(and(...conditions))

    const total = countResult?.count || 0
    const totalPages = Math.ceil(total / limit)

    // Fetch paginated results
    const members = await db
      .select({
        id: teamMembers.id,
        companyId: teamMembers.companyId,
        userId: teamMembers.userId,
        email: teamMembers.email,
        firstName: teamMembers.firstName,
        lastName: teamMembers.lastName,
        role: teamMembers.role,
        status: teamMembers.status,
        invitedAt: teamMembers.invitedAt,
        joinedAt: teamMembers.joinedAt,
        lastActiveAt: teamMembers.lastActiveAt,
        permissions: teamMembers.permissions,
        createdAt: teamMembers.createdAt,
      })
      .from(teamMembers)
      .where(and(...conditions))
      .orderBy(desc(teamMembers.createdAt))
      .limit(limit)
      .offset(offset)

    return NextResponse.json({
      members,
      pagination: {
        page,
        perPage: limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ message: 'Error listing team members', error })

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Failed to list team members' },
      { status: 500 }
    )
  }
}

// Export wrapped handlers with request tracing middleware and CSRF protection
export const POST = withApiMiddleware(_POST, { csrfProtection: true })
export const GET = withApiMiddleware(_GET)
