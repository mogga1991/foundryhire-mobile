/**
 * Input Sanitization Utilities
 *
 * Provides defense-in-depth sanitization for user inputs.
 * Note: These are NOT replacements for parameterized queries, but additional protection.
 */

interface SanitizeOptions {
  maxLength?: number
  allowNewlines?: boolean
}

/**
 * HTML entity map for escaping
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
}

/**
 * Escape HTML entities to prevent XSS
 */
function escapeHtml(str: string): string {
  return str.replace(/[&<>"'/]/g, (char) => HTML_ENTITIES[char] || char)
}

/**
 * Sanitize HTML content by stripping tags and escaping entities
 *
 * @param input - The input string to sanitize
 * @returns Sanitized string with HTML tags removed and entities escaped
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  // Strip HTML tags (basic regex approach)
  let sanitized = input.replace(/<[^>]*>/g, '')

  // Escape remaining HTML entities
  sanitized = escapeHtml(sanitized)

  return sanitized
}

/**
 * Sanitize input for database storage (defense in depth)
 * Prevents SQL-like injection patterns even though we use parameterized queries
 *
 * @param input - The input string to sanitize
 * @returns Sanitized string
 */
export function sanitizeForDb(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '')

  // Remove common SQL injection patterns (defense in depth only)
  // Note: This is NOT a replacement for parameterized queries
  sanitized = sanitized.replace(/[;'"]--/g, '')
  sanitized = sanitized.replace(/\/\*.*?\*\//g, '')

  return sanitized.trim()
}

/**
 * General purpose input sanitizer
 *
 * @param input - The input string to sanitize
 * @param options - Sanitization options
 * @returns Sanitized string
 */
export function sanitizeUserInput(
  input: string,
  options: SanitizeOptions = {}
): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  const { maxLength, allowNewlines = false } = options

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '')

  // Remove control characters except newlines/tabs if allowed
  if (allowNewlines) {
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  } else {
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '')
  }

  // Trim whitespace
  sanitized = sanitized.trim()

  // Apply max length if specified
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }

  return sanitized
}

/**
 * Sanitize a filename to prevent directory traversal
 *
 * @param filename - The filename to sanitize
 * @returns Safe filename
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return ''
  }

  // Remove directory separators
  let sanitized = filename.replace(/[/\\]/g, '')

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '')

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '')

  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '')

  // Limit length
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255)
  }

  return sanitized
}

/**
 * Sanitize a URL to prevent javascript: and data: URLs
 *
 * @param url - The URL to sanitize
 * @returns Safe URL or empty string if invalid
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return ''
  }

  const trimmed = url.trim().toLowerCase()

  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:']
  for (const protocol of dangerousProtocols) {
    if (trimmed.startsWith(protocol)) {
      return ''
    }
  }

  // Only allow http, https, mailto
  if (trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('mailto:') ||
      trimmed.startsWith('/')) {
    return url.trim()
  }

  // If no protocol, assume relative URL
  if (!trimmed.includes(':')) {
    return url.trim()
  }

  return ''
}

/**
 * Sanitize email address
 *
 * @param email - The email to sanitize
 * @returns Sanitized email or empty string if invalid format
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return ''
  }

  // Basic email validation and sanitization
  const trimmed = email.trim().toLowerCase()

  // Very basic email regex (not comprehensive, just for sanitization)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(trimmed)) {
    return ''
  }

  // Remove control characters
  const sanitized = trimmed.replace(/[\x00-\x1F\x7F]/g, '')

  return sanitized
}

/**
 * Sanitize phone number
 *
 * @param phone - The phone number to sanitize
 * @returns Sanitized phone number with only digits, spaces, parentheses, hyphens, and plus sign
 */
export function sanitizePhoneNumber(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    return ''
  }

  // Keep only valid phone number characters
  const sanitized = phone.replace(/[^0-9+\s()-]/g, '').trim()

  return sanitized
}

/**
 * Batch sanitize an object's string fields
 *
 * @param obj - Object with string fields to sanitize
 * @param fields - Array of field names to sanitize
 * @param sanitizer - Sanitizer function to use (defaults to sanitizeUserInput)
 * @returns Object with sanitized fields
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  fields: string[],
  sanitizer: (input: string) => string = sanitizeUserInput
): T {
  const sanitized = { ...obj } as Record<string, unknown>

  for (const field of fields) {
    if (field in sanitized && typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizer(sanitized[field] as string)
    }
  }

  return sanitized as T
}
