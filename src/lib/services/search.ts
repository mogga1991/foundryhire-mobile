/**
 * Full-text search service for candidates.
 *
 * Uses PostgreSQL tsvector + ts_rank for ranked full-text search with
 * fallback to ILIKE for short queries or when the search_vector column
 * is not yet populated.
 */

import { db } from '@/lib/db'
import { candidates } from '@/lib/db/schema'
import { sql, eq, and, inArray, gte, lte, ilike, or, type SQL } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { escapeLikePattern } from '@/lib/utils/sql-escape'

const logger = createLogger('search-service')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchOptions {
  query: string
  companyId: string
  filters?: {
    status?: string[]
    stage?: string[]
    location?: string
    skills?: string[]
    minScore?: number
    maxScore?: number
    dateRange?: { start: Date; end: Date }
  }
  sort?: 'relevance' | 'newest' | 'name' | 'score'
  page?: number
  limit?: number
}

export interface SearchResultCandidate {
  id: string
  firstName: string
  lastName: string
  email: string | null
  currentTitle: string | null
  currentCompany: string | null
  location: string | null
  skills: string[] | null
  status: string
  stage: string
  aiScore: number | null
  createdAt: Date
  relevanceRank?: number
}

export interface SearchResult {
  candidates: SearchResultCandidate[]
  total: number
  page: number
  totalPages: number
  searchDuration: number // ms
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Search candidates using PostgreSQL full-text search with fallback to ILIKE.
 *
 * When `query` is provided and >= 2 characters, uses plainto_tsquery + ts_rank
 * for ranked results. Falls back to ILIKE for very short queries (1 char) or
 * when no query is specified (filter-only mode).
 */
export async function searchCandidates(options: SearchOptions): Promise<SearchResult> {
  const start = Date.now()
  const {
    query,
    companyId,
    filters,
    sort = 'relevance',
    page = 1,
    limit = 20,
  } = options

  const safeLimit = Math.min(Math.max(limit, 1), 100)
  const safePage = Math.max(page, 1)
  const offset = (safePage - 1) * safeLimit

  logger.info({
    message: 'Searching candidates',
    companyId,
    query: query.substring(0, 100),
    sort,
    page: safePage,
    limit: safeLimit,
  })

  try {
    // Build WHERE conditions
    const conditions: SQL[] = [
      eq(candidates.companyId, companyId),
    ]

    // Apply optional filters
    if (filters?.status?.length) {
      conditions.push(inArray(candidates.status, filters.status))
    }

    if (filters?.stage?.length) {
      conditions.push(inArray(candidates.stage, filters.stage))
    }

    if (filters?.location) {
      const escapedLocation = escapeLikePattern(filters.location)
      conditions.push(ilike(candidates.location, `%${escapedLocation}%`))
    }

    if (filters?.skills?.length) {
      // Match candidates who have ANY of the specified skills
      const skillConditions = filters.skills.map((skill) => {
        const escapedSkill = escapeLikePattern(skill)
        return sql`EXISTS (
          SELECT 1 FROM unnest(${candidates.skills}) AS s
          WHERE LOWER(s) LIKE LOWER(${`%${escapedSkill}%`})
        )`
      })
      conditions.push(or(...skillConditions)!)
    }

    if (filters?.minScore !== undefined) {
      conditions.push(gte(candidates.aiScore, filters.minScore))
    }

    if (filters?.maxScore !== undefined) {
      conditions.push(lte(candidates.aiScore, filters.maxScore))
    }

    if (filters?.dateRange?.start) {
      conditions.push(gte(candidates.createdAt, filters.dateRange.start))
    }

    if (filters?.dateRange?.end) {
      conditions.push(lte(candidates.createdAt, filters.dateRange.end))
    }

    // Determine whether to use full-text search or ILIKE fallback
    const trimmedQuery = query.trim()
    const useFullTextSearch = trimmedQuery.length >= 2

    // Build the query with optional full-text search ranking
    let orderClause: SQL

    if (useFullTextSearch && sort === 'relevance') {
      // Use full-text search with ts_rank for ordering
      conditions.push(
        sql`search_vector @@ plainto_tsquery('english', ${trimmedQuery})`
      )
      orderClause = sql`ts_rank(search_vector, plainto_tsquery('english', ${trimmedQuery})) DESC`
    } else if (trimmedQuery.length === 1) {
      // Single character fallback to ILIKE
      const escapedQuery = escapeLikePattern(trimmedQuery)
      conditions.push(
        or(
          ilike(candidates.firstName, `%${escapedQuery}%`),
          ilike(candidates.lastName, `%${escapedQuery}%`),
          ilike(candidates.email, `%${escapedQuery}%`),
        )!
      )
      orderClause = buildSortClause(sort)
    } else if (trimmedQuery.length === 0) {
      // No query — filter-only mode
      orderClause = buildSortClause(sort)
    } else {
      // Full-text search for non-relevance sorts
      conditions.push(
        sql`search_vector @@ plainto_tsquery('english', ${trimmedQuery})`
      )
      orderClause = buildSortClause(sort)
    }

    const whereClause = and(...conditions)

    // Count total matching rows
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(candidates)
      .where(whereClause)

    const total = countRow?.count ?? 0

    // Fetch paginated results
    const rows = await db
      .select({
        id: candidates.id,
        firstName: candidates.firstName,
        lastName: candidates.lastName,
        email: candidates.email,
        currentTitle: candidates.currentTitle,
        currentCompany: candidates.currentCompany,
        location: candidates.location,
        skills: candidates.skills,
        status: candidates.status,
        stage: candidates.stage,
        aiScore: candidates.aiScore,
        createdAt: candidates.createdAt,
      })
      .from(candidates)
      .where(whereClause)
      .orderBy(orderClause)
      .limit(safeLimit)
      .offset(offset)

    const searchDuration = Date.now() - start

    logger.info({
      message: 'Search completed',
      total,
      returned: rows.length,
      searchDurationMs: searchDuration,
      usedFullTextSearch: useFullTextSearch,
    })

    return {
      candidates: rows,
      total,
      page: safePage,
      totalPages: Math.ceil(total / safeLimit),
      searchDuration,
    }
  } catch (error) {
    const searchDuration = Date.now() - start

    // If full-text search fails (e.g., search_vector column doesn't exist yet),
    // fall back to ILIKE
    if (
      error instanceof Error &&
      error.message.includes('search_vector')
    ) {
      logger.warn({
        message: 'Full-text search failed, falling back to ILIKE',
        error: error.message,
      })
      return searchCandidatesFallback(options, start)
    }

    logger.error({
      message: 'Candidate search failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      searchDurationMs: searchDuration,
    })

    throw error
  }
}

// ---------------------------------------------------------------------------
// Fallback: ILIKE search (used when search_vector column is not available)
// ---------------------------------------------------------------------------

async function searchCandidatesFallback(
  options: SearchOptions,
  startTime: number
): Promise<SearchResult> {
  const {
    query,
    companyId,
    filters,
    sort = 'newest',
    page = 1,
    limit = 20,
  } = options

  const safeLimit = Math.min(Math.max(limit, 1), 100)
  const safePage = Math.max(page, 1)
  const offset = (safePage - 1) * safeLimit
  const trimmedQuery = query.trim()

  const conditions: SQL[] = [
    eq(candidates.companyId, companyId),
  ]

  if (trimmedQuery.length > 0) {
    const escapedQuery = escapeLikePattern(trimmedQuery)
    conditions.push(
      or(
        ilike(candidates.firstName, `%${escapedQuery}%`),
        ilike(candidates.lastName, `%${escapedQuery}%`),
        ilike(candidates.email, `%${escapedQuery}%`),
        ilike(candidates.currentTitle, `%${escapedQuery}%`),
        ilike(candidates.currentCompany, `%${escapedQuery}%`),
      )!
    )
  }

  // Apply the same filters
  if (filters?.status?.length) {
    conditions.push(inArray(candidates.status, filters.status))
  }
  if (filters?.stage?.length) {
    conditions.push(inArray(candidates.stage, filters.stage))
  }
  if (filters?.location) {
    const escapedLocation = escapeLikePattern(filters.location)
    conditions.push(ilike(candidates.location, `%${escapedLocation}%`))
  }
  if (filters?.minScore !== undefined) {
    conditions.push(gte(candidates.aiScore, filters.minScore))
  }
  if (filters?.maxScore !== undefined) {
    conditions.push(lte(candidates.aiScore, filters.maxScore))
  }

  const whereClause = and(...conditions)
  const orderClause = buildSortClause(sort === 'relevance' ? 'newest' : sort)

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(candidates)
    .where(whereClause)

  const total = countRow?.count ?? 0

  const rows = await db
    .select({
      id: candidates.id,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      email: candidates.email,
      currentTitle: candidates.currentTitle,
      currentCompany: candidates.currentCompany,
      location: candidates.location,
      skills: candidates.skills,
      status: candidates.status,
      stage: candidates.stage,
      aiScore: candidates.aiScore,
      createdAt: candidates.createdAt,
    })
    .from(candidates)
    .where(whereClause)
    .orderBy(orderClause)
    .limit(safeLimit)
    .offset(offset)

  const searchDuration = Date.now() - startTime

  return {
    candidates: rows,
    total,
    page: safePage,
    totalPages: Math.ceil(total / safeLimit),
    searchDuration,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSortClause(sort: string): SQL {
  switch (sort) {
    case 'newest':
      return sql`${candidates.createdAt} DESC`
    case 'name':
      return sql`${candidates.lastName} ASC, ${candidates.firstName} ASC`
    case 'score':
      return sql`${candidates.aiScore} DESC NULLS LAST`
    case 'relevance':
    default:
      return sql`${candidates.createdAt} DESC`
  }
}
