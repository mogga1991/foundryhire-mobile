import crypto from 'crypto'

/**
 * Create a deterministic hash for anonymized email addresses
 */
export function hashEmail(email: string): string {
  const hash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex')
  return `deleted-${hash.substring(0, 16)}@redacted.local`
}

/**
 * Anonymize text by replacing name patterns with [REDACTED]
 */
export function anonymizeText(text: string, namePatterns: string[]): string {
  if (!text) {
    return text
  }

  let anonymized = text

  for (const pattern of namePatterns) {
    if (!pattern || pattern.trim().length === 0) {
      continue
    }

    // Create a case-insensitive regex that matches the pattern
    // Use word boundaries only if pattern starts/ends with word characters
    const escapedPattern = escapeRegExp(pattern)
    const startsWithWord = /^\w/.test(pattern)
    const endsWithWord = /\w$/.test(pattern)
    const prefix = startsWithWord ? '\\b' : ''
    const suffix = endsWithWord ? '\\b' : ''
    const regex = new RegExp(`${prefix}${escapedPattern}${suffix}`, 'gi')
    anonymized = anonymized.replace(regex, '[REDACTED]')
  }

  return anonymized
}

/**
 * Anonymize interview transcript by replacing candidate name references
 */
export function anonymizeTranscript(transcript: string, candidateName: string): string {
  if (!transcript || !candidateName) {
    return transcript
  }

  const namePatterns = generateNamePatterns(candidateName)
  return anonymizeText(transcript, namePatterns)
}

/**
 * Generate various patterns of a candidate's name for redaction
 * e.g., "John Doe" -> ["John Doe", "John", "Doe", "J. Doe", etc.]
 */
function generateNamePatterns(fullName: string): string[] {
  if (!fullName || fullName.trim().length === 0) {
    return []
  }

  const patterns: string[] = []
  const normalized = fullName.trim()

  // Add the full name
  patterns.push(normalized)

  // Split into parts (firstName, lastName, etc.)
  const parts = normalized.split(/\s+/)

  if (parts.length >= 2) {
    // Add individual name parts
    patterns.push(...parts)

    // Add first + last initial (e.g., "John D.")
    patterns.push(`${parts[0]} ${parts[parts.length - 1].charAt(0)}.`)

    // Add initial + last (e.g., "J. Doe")
    patterns.push(`${parts[0].charAt(0)}. ${parts[parts.length - 1]}`)

    // Add last, first format (e.g., "Doe, John")
    patterns.push(`${parts[parts.length - 1]}, ${parts[0]}`)
  } else if (parts.length === 1) {
    // Single name
    patterns.push(parts[0])
  }

  // Filter out empty strings and very short patterns (< 2 chars)
  return patterns.filter((p) => p && p.length >= 2)
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Anonymize AI analysis text by removing candidate-specific information
 */
export function anonymizeAIAnalysis(analysis: string, candidateName: string): string {
  if (!analysis) {
    return analysis
  }

  const namePatterns = generateNamePatterns(candidateName)
  let anonymized = anonymizeText(analysis, namePatterns)

  // Also replace common references like "the candidate", "this candidate", etc.
  anonymized = anonymized.replace(/\bthe candidate\b/gi, 'the candidate [REDACTED]')
  anonymized = anonymized.replace(/\bthis candidate\b/gi, 'this candidate [REDACTED]')

  return anonymized
}

/**
 * Sanitize feedback text for GDPR deletion
 */
export function sanitizeFeedback(feedbackText: string): string {
  return 'Feedback removed per GDPR request'
}

/**
 * Sanitize AI summary for GDPR deletion
 */
export function sanitizeAISummary(): string {
  return 'Data removed per GDPR request'
}
