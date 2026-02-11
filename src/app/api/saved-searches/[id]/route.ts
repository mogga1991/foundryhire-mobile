/**
 * Individual Saved Search API
 *
 * DELETE /api/saved-searches/[id]    — Delete a saved search
 * PATCH  /api/saved-searches/[id]    — Update a saved search (rename, change default)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { savedSearches } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('saved-searches')

// ---------------------------------------------------------------------------
// Validation Schemas
// ---------------------------------------------------------------------------

const updateSavedSearchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isDefault: z.boolean().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
})

// ---------------------------------------------------------------------------
// DELETE /api/saved-searches/[id]
// ---------------------------------------------------------------------------

async function _DELETE(
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

    if (rateLimitResult) {
      return rateLimitResult
    }

    const { user, companyId } = await requireCompanyAccess()
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Saved search ID is required' },
        { status: 400 }
      )
    }

    // Verify ownership before deleting
    const [existing] = await db
      .select({ id: savedSearches.id })
      .from(savedSearches)
      .where(
        and(
          eq(savedSearches.id, id),
          eq(savedSearches.companyId, companyId),
          eq(savedSearches.userId, user.id),
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json(
        { error: 'Saved search not found' },
        { status: 404 }
      )
    }

    await db
      .delete(savedSearches)
      .where(eq(savedSearches.id, id))

    logger.info({
      message: 'Deleted saved search',
      userId: user.id,
      savedSearchId: id,
    })

    return NextResponse.json({
      success: true,
      message: 'Saved search deleted',
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'No company found' }, { status: 403 })
    }

    logger.error({
      message: 'Failed to delete saved search',
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: 'Failed to delete saved search' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/saved-searches/[id]
// ---------------------------------------------------------------------------

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

    if (rateLimitResult) {
      return rateLimitResult
    }

    const { user, companyId } = await requireCompanyAccess()
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Saved search ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const parsed = updateSavedSearchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updates = parsed.data

    // Verify ownership
    const [existing] = await db
      .select({
        id: savedSearches.id,
        entity: savedSearches.entity,
      })
      .from(savedSearches)
      .where(
        and(
          eq(savedSearches.id, id),
          eq(savedSearches.companyId, companyId),
          eq(savedSearches.userId, user.id),
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json(
        { error: 'Saved search not found' },
        { status: 404 }
      )
    }

    // If setting as default, unset any existing default for this entity
    if (updates.isDefault === true) {
      await db
        .update(savedSearches)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(savedSearches.companyId, companyId),
            eq(savedSearches.userId, user.id),
            eq(savedSearches.entity, existing.entity),
            eq(savedSearches.isDefault, true),
          )
        )
    }

    // Build update set
    const updateSet: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (updates.name !== undefined) {
      updateSet.name = updates.name
    }
    if (updates.isDefault !== undefined) {
      updateSet.isDefault = updates.isDefault
    }
    if (updates.filters !== undefined) {
      updateSet.filters = updates.filters
    }

    const [updated] = await db
      .update(savedSearches)
      .set(updateSet)
      .where(eq(savedSearches.id, id))
      .returning()

    logger.info({
      message: 'Updated saved search',
      userId: user.id,
      savedSearchId: id,
      updatedFields: Object.keys(updates),
    })

    return NextResponse.json({
      success: true,
      savedSearch: updated,
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'No company found' }, { status: 403 })
    }

    logger.error({
      message: 'Failed to update saved search',
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: 'Failed to update saved search' },
      { status: 500 }
    )
  }
}

export const DELETE = withApiMiddleware(_DELETE, { csrfProtection: true })
export const PATCH = withApiMiddleware(_PATCH, { csrfProtection: true })
