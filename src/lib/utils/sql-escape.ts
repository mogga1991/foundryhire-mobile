/**
 * SQL LIKE Pattern Escape Utility
 *
 * Prevents LIKE wildcard injection by escaping special characters
 * ('%', '_', '\') used in PostgreSQL LIKE/ILIKE patterns.
 *
 * @module sql-escape
 */

/**
 * Escapes special LIKE pattern characters to prevent wildcard injection.
 *
 * @param str - The user input string to escape
 * @returns The escaped string safe for use in LIKE/ILIKE patterns
 *
 * @example
 * ```typescript
 * // Before (vulnerable):
 * ilike(candidates.firstName, `%${search}%`)
 *
 * // After (secure):
 * ilike(candidates.firstName, `%${escapeLikePattern(search)}%`)
 * ```
 */
export function escapeLikePattern(str: string): string {
  // Escape backslashes, percent signs, and underscores
  // Order matters: backslash must be escaped first
  return str.replace(/[%_\\]/g, '\\$&')
}
