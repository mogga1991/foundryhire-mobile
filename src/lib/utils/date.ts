/**
 * Date utility functions for VerticalHire
 */

/**
 * Calculate the number of days between a given date and now.
 * Returns a positive number if the date is in the past.
 */
export function daysAgo(date: string | Date): number {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Check if a date is in the past (overdue).
 */
export function isOverdue(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.getTime() < Date.now()
}

/**
 * Add a specified number of days to a date and return a new Date object.
 */
export function addDays(date: string | Date, days: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime())
  d.setDate(d.getDate() + days)
  return d
}
