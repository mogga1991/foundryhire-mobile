/**
 * Saved Searches API
 *
 * GET  /api/saved-searches       — List saved searches for the current user
 * POST /api/saved-searches       — Create a new saved search
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { savedSearches } from '@/lib/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('saved-searches')

// ---------------------------------------------------------------------------
// Validation Schemas
// ---------------------------------------------------------------------------

const createSavedSearchSchema = z.object({
  name: z.string().min(1).max(100),
  entity: z.enum(['candidates', 'interviews', 'jobs']),
  filters: z.record(z.string(), z.unknown()), // Flexible JSON filter configuration
  isDefault: z.boolean().optional().default(false),
})

// ---------------------------------------------------------------------------
// GET /api/saved-searches
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // Rate limit: 30/min
    const rateLimitResult = await rateLimit(request, {
      limit: 30,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })

    if (rateLimitResult) {
      return rateLimitResult
    }

    const { user, companyId } = await requireCompanyAccess()

    // Optional entity filter from query params
    const entityFilter = request.nextUrl.searchParams.get('entity')

    // Pagination params
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1'))
    const perPage = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('perPage') || '20')))

    const conditions = [
      eq(savedSearches.companyId, companyId),
      eq(savedSearches.userId, user.id),
    ]

    if (entityFilter && ['candidates', 'interviews', 'jobs'].includes(entityFilter)) {
      conditions.push(eq(savedSearches.entity, entityFilter))
    }

    // Count total
    const [{ count: totalCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(savedSearches)
      .where(and(...conditions))

    const total = totalCount || 0
    const totalPages = Math.ceil(total / perPage)

    // Fetch paginated results
    const searches = await db
      .select()
      .from(savedSearches)
      .where(and(...conditions))
      .orderBy(desc(savedSearches.updatedAt))
      .limit(perPage)
      .offset((page - 1) * perPage)

    logger.info({
      message: 'Listed saved searches',
      userId: user.id,
      count: searches.length,
      entity: entityFilter ?? 'all',
      page,
      perPage,
    })

    return NextResponse.json({
      success: true,
      savedSearches: searches,
      pagination: {
        page,
        perPage,
        total,
        totalPages,
      },
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
      message: 'Failed to list saved searches',
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: 'Failed to list saved searches' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/saved-searches
// ---------------------------------------------------------------------------

async function _POST(request: NextRequest) {
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

    const body = await request.json()
    const parsed = createSavedSearchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, entity, filters, isDefault } = parsed.data

    // Enforce max 20 saved searches per user
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(savedSearches)
      .where(
        and(
          eq(savedSearches.companyId, companyId),
          eq(savedSearches.userId, user.id),
        )
      )

    const currentCount = countRow?.count ?? 0

    if (currentCount >= 20) {
      return NextResponse.json(
        { error: 'Maximum of 20 saved searches reached. Please delete an existing one first.' },
        { status: 400 }
      )
    }

    // If this is set as default, unset any existing default for this entity
    if (isDefault) {
      await db
        .update(savedSearches)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(savedSearches.companyId, companyId),
            eq(savedSearches.userId, user.id),
            eq(savedSearches.entity, entity),
            eq(savedSearches.isDefault, true),
          )
        )
    }

    const [newSearch] = await db
      .insert(savedSearches)
      .values({
        companyId,
        userId: user.id,
        name,
        entity,
        filters,
        isDefault,
      })
      .returning()

    logger.info({
      message: 'Created saved search',
      userId: user.id,
      savedSearchId: newSearch.id,
      entity,
      name,
    })

    return NextResponse.json({
      success: true,
      savedSearch: newSearch,
    }, { status: 201 })
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
      message: 'Failed to create saved search',
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: 'Failed to create saved search' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
