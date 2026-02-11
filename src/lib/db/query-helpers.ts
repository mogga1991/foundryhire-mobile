import { SQL, sql } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

/**
 * Query helper utilities to reduce code duplication across route handlers
 * Provides reusable patterns for pagination, filtering, and searching
 */

/**
 * Standard pagination parameters
 */
export interface PaginationParams {
  page?: number
  limit?: number
}

/**
 * Pagination result metadata
 */
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

/**
 * Apply pagination to a query and calculate metadata
 *
 * @param baseQuery - The base query builder (can be select() or other query)
 * @param totalCount - Total number of records (from a separate COUNT query)
 * @param params - Pagination parameters (page, limit)
 * @returns Pagination metadata and offset to apply to query
 *
 * @example
 * ```ts
 * const total = await db.select({ count: sql`count(*)::int` }).from(candidates).where(conditions)
 * const pagination = paginateQuery(total[0].count, { page: 1, limit: 20 })
 *
 * const results = await db.select()
 *   .from(candidates)
 *   .where(conditions)
 *   .limit(pagination.meta.limit)
 *   .offset(pagination.offset)
 * ```
 */
export function paginateQuery(
  totalCount: number,
  params: PaginationParams = {}
): { meta: PaginationMeta; offset: number } {
  const page = Math.max(1, params.page || 1)
  const limit = Math.min(Math.max(1, params.limit || 20), 100) // Cap at 100
  const totalPages = Math.ceil(totalCount / limit)
  const offset = (page - 1) * limit

  return {
    meta: {
      page,
      limit,
      total: totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
    offset,
  }
}

/**
 * Build a date range filter condition
 *
 * @param column - The date column to filter on
 * @param startDate - Optional start date (inclusive)
 * @param endDate - Optional end date (inclusive, end of day)
 * @returns SQL condition or null if no dates provided
 *
 * @example
 * ```ts
 * const dateFilter = buildDateRangeFilter(
 *   interviews.scheduledAt,
 *   '2026-01-01',
 *   '2026-01-31'
 * )
 * if (dateFilter) conditions.push(dateFilter)
 * ```
 */
export function buildDateRangeFilter(
  column: PgColumn,
  startDate?: string | null,
  endDate?: string | null
): SQL | null {
  const conditions: SQL[] = []

  if (startDate) {
    conditions.push(sql`${column} >= ${new Date(startDate)}`)
  }

  if (endDate) {
    // Set to end of day (23:59:59.999)
    const endDateTime = new Date(endDate)
    endDateTime.setHours(23, 59, 59, 999)
    conditions.push(sql`${column} <= ${endDateTime}`)
  }

  if (conditions.length === 0) return null
  if (conditions.length === 1) return conditions[0]

  // Combine with AND
  return sql`(${conditions[0]} AND ${conditions[1]})`
}

/**
 * Build a multi-column ILIKE search condition
 *
 * @param columns - Array of text columns to search across
 * @param searchTerm - The search term to match (case-insensitive)
 * @returns SQL condition or null if no search term
 *
 * @example
 * ```ts
 * const searchFilter = buildSearchCondition(
 *   [candidates.firstName, candidates.lastName, candidates.email],
 *   'john'
 * )
 * if (searchFilter) conditions.push(searchFilter)
 * ```
 */
export function buildSearchCondition(
  columns: PgColumn[],
  searchTerm?: string | null
): SQL | null {
  if (!searchTerm || !searchTerm.trim()) return null

  const term = searchTerm.trim()
  const pattern = `%${term}%`

  // Create ILIKE conditions for each column
  const conditions = columns.map(column => sql`${column} ILIKE ${pattern}`)

  if (conditions.length === 0) return null
  if (conditions.length === 1) return conditions[0]

  // Combine with OR
  return sql`(${sql.join(conditions, sql` OR `)})`
}

/**
 * Build a full-name search condition (first + last name)
 *
 * @param firstNameColumn - First name column
 * @param lastNameColumn - Last name column
 * @param searchTerm - The search term
 * @returns SQL condition or null if no search term
 *
 * @example
 * ```ts
 * const nameSearch = buildFullNameSearch(
 *   candidates.firstName,
 *   candidates.lastName,
 *   'john doe'
 * )
 * if (nameSearch) conditions.push(nameSearch)
 * ```
 */
export function buildFullNameSearch(
  firstNameColumn: PgColumn,
  lastNameColumn: PgColumn,
  searchTerm?: string | null
): SQL | null {
  if (!searchTerm || !searchTerm.trim()) return null

  const term = searchTerm.trim()
  const pattern = `%${term}%`

  // Search in individual columns OR concatenated full name
  return sql`(
    ${firstNameColumn} ILIKE ${pattern}
    OR ${lastNameColumn} ILIKE ${pattern}
    OR CONCAT(${firstNameColumn}, ' ', ${lastNameColumn}) ILIKE ${pattern}
  )`
}

/**
 * Build an IN clause condition for array filtering
 *
 * @param column - The column to filter
 * @param values - Array of values to match
 * @returns SQL condition or null if no values
 *
 * @example
 * ```ts
 * const statusFilter = buildInCondition(
 *   interviews.status,
 *   ['scheduled', 'confirmed']
 * )
 * if (statusFilter) conditions.push(statusFilter)
 * ```
 */
export function buildInCondition<T>(
  column: PgColumn,
  values?: T[] | null
): SQL | null {
  if (!values || values.length === 0) return null

  return sql`${column} IN ${values}`
}

/**
 * Parse comma-separated string into array
 *
 * @param value - Comma-separated string or null
 * @returns Array of trimmed non-empty strings
 *
 * @example
 * ```ts
 * const statuses = parseCommaSeparated('scheduled,confirmed,completed')
 * // ['scheduled', 'confirmed', 'completed']
 * ```
 */
export function parseCommaSeparated(value?: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
}

/**
 * Safely parse integer from string with default
 *
 * @param value - String value to parse
 * @param defaultValue - Default value if parsing fails
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Parsed integer within bounds
 *
 * @example
 * ```ts
 * const page = parseIntWithDefault(searchParams.get('page'), 1, 1, 1000)
 * const limit = parseIntWithDefault(searchParams.get('limit'), 20, 1, 100)
 * ```
 */
export function parseIntWithDefault(
  value: string | null | undefined,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  const parsed = parseInt(value || '', 10)

  if (isNaN(parsed)) return defaultValue

  let result = parsed

  if (min !== undefined) result = Math.max(min, result)
  if (max !== undefined) result = Math.min(max, result)

  return result
}

/**
 * Build ORDER BY clause based on sort parameters
 *
 * @param sortField - Field name to sort by
 * @param sortOrder - Sort direction ('asc' or 'desc')
 * @param columnMap - Map of field names to database columns
 * @param defaultColumn - Default column if field not found
 * @returns SQL order expression
 *
 * @example
 * ```ts
 * const orderBy = buildOrderBy(
 *   'created_at',
 *   'desc',
 *   {
 *     created_at: candidates.createdAt,
 *     ai_score: candidates.aiScore,
 *     first_name: candidates.firstName,
 *   },
 *   candidates.createdAt
 * )
 * ```
 */
export function buildOrderBy(
  sortField: string | null | undefined,
  sortOrder: string | null | undefined,
  columnMap: Record<string, PgColumn>,
  defaultColumn: PgColumn
): SQL {
  const column = sortField && columnMap[sortField] ? columnMap[sortField] : defaultColumn
  const order = sortOrder === 'asc' ? sql`ASC` : sql`DESC`

  return sql`${column} ${order}`
}

/**
 * Combine multiple SQL conditions with AND
 *
 * @param conditions - Array of SQL conditions (nulls are filtered out)
 * @returns Combined SQL or undefined if no conditions
 *
 * @example
 * ```ts
 * const conditions = [
 *   eq(candidates.companyId, companyId),
 *   buildDateRangeFilter(candidates.createdAt, startDate, endDate),
 *   buildSearchCondition([candidates.firstName, candidates.lastName], search),
 * ].filter(Boolean)
 *
 * const where = combineConditions(conditions)
 * ```
 */
export function combineConditions(conditions: (SQL | null | undefined)[]): SQL | undefined {
  const validConditions = conditions.filter((c): c is SQL => c !== null && c !== undefined)

  if (validConditions.length === 0) return undefined
  if (validConditions.length === 1) return validConditions[0]

  return sql`(${sql.join(validConditions, sql` AND `)})`
}
