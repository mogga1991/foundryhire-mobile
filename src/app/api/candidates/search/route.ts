import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { candidates } from '@/lib/db/schema'
import { sql, or, and, ilike, gte, lte, eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { escapeLikePattern } from '@/lib/utils/sql-escape'

const logger = createLogger('candidate-search')

async function _GET(req: NextRequest) {
  try {
    // Rate limit: 30 searches per minute per IP
    const rateLimitResult = await rateLimit(req, {
      limit: 30,
      window: 60000,
      identifier: (r) => getIpIdentifier(r),
    })
    if (rateLimitResult) return rateLimitResult

    // Require authentication and company access
    const { companyId } = await requireCompanyAccess()

    const searchParams = req.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const location = searchParams.get('location') || ''
    const experience = searchParams.get('experience') || ''

    // Build query conditions - always filter by company
    const conditions = [eq(candidates.companyId, companyId)]

    // Text search across multiple fields
    if (query) {
      const escapedQuery = escapeLikePattern(query)
      conditions.push(
        or(
          ilike(candidates.firstName, `%${escapedQuery}%`),
          ilike(candidates.lastName, `%${escapedQuery}%`),
          ilike(candidates.currentTitle, `%${escapedQuery}%`),
          ilike(candidates.currentCompany, `%${escapedQuery}%`),
          ilike(candidates.notes, `%${escapedQuery}%`),
          sql`EXISTS (
            SELECT 1 FROM unnest(${candidates.skills}) AS skill
            WHERE LOWER(skill) LIKE LOWER(${`%${escapedQuery}%`})
          )`
        )!
      )
    }

    // Location filter
    if (location) {
      const escapedLocation = escapeLikePattern(location)
      conditions.push(
        ilike(candidates.location, `%${escapedLocation}%`)
      )
    }

    // Experience filter
    if (experience && experience !== 'all') {
      switch (experience) {
        case '0-2':
          conditions.push(
            and(
              gte(candidates.experienceYears, 0),
              lte(candidates.experienceYears, 2)
            )!
          )
          break
        case '3-5':
          conditions.push(
            and(
              gte(candidates.experienceYears, 3),
              lte(candidates.experienceYears, 5)
            )!
          )
          break
        case '6-10':
          conditions.push(
            and(
              gte(candidates.experienceYears, 6),
              lte(candidates.experienceYears, 10)
            )!
          )
          break
        case '10+':
          conditions.push(
            gte(candidates.experienceYears, 10)
          )
          break
      }
    }

    // Execute search with company filter applied
    const whereClause = and(...conditions)

    const results = await db.select({
      id: candidates.id,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      email: candidates.email,
      profileImageUrl: candidates.profileImageUrl,
      location: candidates.location,
      currentTitle: candidates.currentTitle,
      currentCompany: candidates.currentCompany,
      experienceYears: candidates.experienceYears,
      skills: candidates.skills,
      status: candidates.status,
      stage: candidates.stage,
      aiScore: candidates.aiScore,
      createdAt: candidates.createdAt,
    })
      .from(candidates)
      .where(whereClause)
      .orderBy(sql`${candidates.createdAt} DESC`)
      .limit(50)

    logger.info({
      message: 'Candidate search executed',
      companyId,
      query,
      location,
      experience,
      resultCount: results.length,
    })

    return NextResponse.json({
      success: true,
      candidates: results,
      count: results.length,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'No company set up. Please create your company in Settings first.' }, { status: 400 })
    }
    logger.error({ message: 'Failed to search candidates', error })
    return NextResponse.json(
      { error: 'Failed to search candidates' },
      { status: 500 }
    )
  }
}

// Export wrapped handler with request tracing middleware
export const GET = withApiMiddleware(_GET)
