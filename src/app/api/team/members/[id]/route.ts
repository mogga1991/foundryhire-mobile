import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { teamMembers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { isRoleAtLeast, type TeamRole } from '@/lib/auth/permissions'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('team-members-id')

// Zod schema for updating a team member
const updateMemberSchema = z.object({
  role: z.enum(['admin', 'recruiter', 'interviewer', 'viewer']).optional(),
  permissions: z.record(z.string(), z.boolean()).optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
})

// PATCH /api/team/members/[id] — Update member role/permissions
async function _PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limit: 10/min
    const rateLimitResult = await rateLimit(request, {
      limit: 10,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })
    if (rateLimitResult) return rateLimitResult

    const { id: memberId } = await params
    const { user, companyId, role: callerRole } = await requireCompanyAccess()

    // Validate UUID format
    const uuidSchema = z.string().uuid()
    if (!uuidSchema.safeParse(memberId).success) {
      return NextResponse.json(
        { error: 'Invalid member ID format' },
        { status: 400 }
      )
    }

    // Only owner can change roles
    if (!isRoleAtLeast(callerRole as TeamRole, 'owner')) {
      return NextResponse.json(
        { error: 'Forbidden', details: 'Only the owner can update member roles' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = updateMemberSchema.safeParse(body)

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

    const { role, permissions, firstName, lastName } = validation.data

    // Fetch the target member
    const [targetMember] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.id, memberId), eq(teamMembers.companyId, companyId)))
      .limit(1)

    if (!targetMember) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      )
    }

    // Cannot demote self (owner) - note: role from API can't be 'owner' per schema
    // but targetMember.role from DB can be
    if (targetMember.userId === user.id && (targetMember.role as string) === 'owner') {
      if (role) {
        return NextResponse.json(
          { error: 'Forbidden', details: 'Cannot demote yourself as owner' },
          { status: 403 }
        )
      }
    }

    // Cannot change another owner's role
    if ((targetMember.role as string) === 'owner' && role) {
      return NextResponse.json(
        { error: 'Forbidden', details: 'Cannot change another owner\'s role' },
        { status: 403 }
      )
    }

    // Build update payload
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (role !== undefined) updateData.role = role
    if (permissions !== undefined) updateData.permissions = permissions
    if (firstName !== undefined) updateData.firstName = firstName
    if (lastName !== undefined) updateData.lastName = lastName

    const [updatedMember] = await db
      .update(teamMembers)
      .set(updateData)
      .where(and(eq(teamMembers.id, memberId), eq(teamMembers.companyId, companyId)))
      .returning()

    logger.info({
      message: 'Team member updated',
      companyId,
      memberId,
      updatedBy: user.id,
      changes: Object.keys(updateData).filter((k) => k !== 'updatedAt'),
    })

    return NextResponse.json({ member: updatedMember })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ message: 'Error updating team member', error })

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Failed to update team member', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE /api/team/members/[id] — Deactivate (soft delete) a team member
async function _DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limit: 5/min
    const rateLimitResult = await rateLimit(request, {
      limit: 5,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })
    if (rateLimitResult) return rateLimitResult

    const { id: memberId } = await params
    const { user, companyId, role: callerRole } = await requireCompanyAccess()

    // Validate UUID format
    const uuidSchema = z.string().uuid()
    if (!uuidSchema.safeParse(memberId).success) {
      return NextResponse.json(
        { error: 'Invalid member ID format' },
        { status: 400 }
      )
    }

    // Only owner/admin can remove members
    if (!isRoleAtLeast(callerRole as TeamRole, 'admin')) {
      return NextResponse.json(
        { error: 'Forbidden', details: 'Only owners and admins can remove team members' },
        { status: 403 }
      )
    }

    // Fetch the target member
    const [targetMember] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.id, memberId), eq(teamMembers.companyId, companyId)))
      .limit(1)

    if (!targetMember) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      )
    }

    // Cannot remove self
    if (targetMember.userId === user.id) {
      return NextResponse.json(
        { error: 'Forbidden', details: 'Cannot remove yourself from the team' },
        { status: 403 }
      )
    }

    // Cannot remove an owner
    if ((targetMember.role as string) === 'owner') {
      return NextResponse.json(
        { error: 'Forbidden', details: 'Cannot remove the team owner' },
        { status: 403 }
      )
    }

    // Admins cannot remove other admins (only owner can)
    if ((targetMember.role as string) === 'admin' && callerRole !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden', details: 'Only the owner can remove admin members' },
        { status: 403 }
      )
    }

    // Soft delete: set status to deactivated
    const [deactivatedMember] = await db
      .update(teamMembers)
      .set({
        status: 'deactivated',
        updatedAt: new Date(),
      })
      .where(and(eq(teamMembers.id, memberId), eq(teamMembers.companyId, companyId)))
      .returning()

    logger.info({
      message: 'Team member deactivated',
      companyId,
      memberId,
      deactivatedBy: user.id,
      memberEmail: targetMember.email,
    })

    return NextResponse.json({ member: deactivatedMember })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ message: 'Error deactivating team member', error })

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Failed to deactivate team member', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const PATCH = withApiMiddleware(_PATCH, { csrfProtection: true })
export const DELETE = withApiMiddleware(_DELETE, { csrfProtection: true })
