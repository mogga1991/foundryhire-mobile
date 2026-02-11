/**
 * Timing-safe comparison utilities
 *
 * Prevents timing attacks by ensuring comparisons take constant time
 */

import { timingSafeEqual } from 'crypto'

/**
 * Safely compare two strings using constant-time comparison
 *
 * @param a First string to compare
 * @param b Second string to compare
 * @returns true if strings are equal, false otherwise
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
