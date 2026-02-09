import type { CandidateScoringResult } from '@/lib/ai/prompts/candidate-scoring'

/**
 * Safely parse a candidate scoring response from Claude.
 * Handles cases where the response may contain markdown wrapping,
 * extra text, or malformed JSON.
 */
export function parseAIScore(response: string): CandidateScoringResult | null {
  try {
    const json = extractJSON<CandidateScoringResult>(response)

    if (json === null) {
      return null
    }

    // Validate required fields and coerce types
    const score = typeof json.score === 'number' ? json.score : Number(json.score)
    if (isNaN(score) || score < 0 || score > 100) {
      return null
    }

    const validRecommendations = ['strong_yes', 'yes', 'maybe', 'no', 'strong_no'] as const
    const recommendation = validRecommendations.includes(
      json.recommendation as (typeof validRecommendations)[number]
    )
      ? json.recommendation
      : 'maybe'

    return {
      score: Math.round(score),
      reasoning: typeof json.reasoning === 'string' ? json.reasoning : '',
      strengths: Array.isArray(json.strengths)
        ? json.strengths.filter((s): s is string => typeof s === 'string')
        : [],
      concerns: Array.isArray(json.concerns)
        ? json.concerns.filter((c): c is string => typeof c === 'string')
        : [],
      recommendation,
    }
  } catch {
    return null
  }
}

/**
 * Extract a JSON object from a string that may contain markdown code blocks,
 * leading/trailing text, or other non-JSON content.
 *
 * Attempts multiple extraction strategies in order:
 * 1. Direct JSON.parse of trimmed text
 * 2. Extract from markdown code blocks (```json ... ``` or ``` ... ```)
 * 3. Find the first { ... } or [ ... ] boundary in the text
 */
export function extractJSON<T = unknown>(text: string): T | null {
  if (!text || typeof text !== 'string') {
    return null
  }

  const trimmed = text.trim()

  // Strategy 1: Direct parse
  try {
    return JSON.parse(trimmed) as T
  } catch {
    // Continue to next strategy
  }

  // Strategy 2: Extract from markdown code blocks
  const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/
  const codeBlockMatch = trimmed.match(codeBlockRegex)
  if (codeBlockMatch?.[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 3: Find JSON object boundaries
  const firstBrace = trimmed.indexOf('{')
  const firstBracket = trimmed.indexOf('[')

  let startIndex: number
  let openChar: string
  let closeChar: string

  if (firstBrace === -1 && firstBracket === -1) {
    return null
  } else if (firstBrace === -1) {
    startIndex = firstBracket
    openChar = '['
    closeChar = ']'
  } else if (firstBracket === -1) {
    startIndex = firstBrace
    openChar = '{'
    closeChar = '}'
  } else {
    startIndex = Math.min(firstBrace, firstBracket)
    openChar = startIndex === firstBrace ? '{' : '['
    closeChar = startIndex === firstBrace ? '}' : ']'
  }

  // Walk through the string to find the matching closing bracket,
  // accounting for nesting and string literals
  let depth = 0
  let inString = false
  let escapeNext = false

  for (let i = startIndex; i < trimmed.length; i++) {
    const char = trimmed[i]

    if (escapeNext) {
      escapeNext = false
      continue
    }

    if (char === '\\' && inString) {
      escapeNext = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) {
      continue
    }

    if (char === openChar) {
      depth++
    } else if (char === closeChar) {
      depth--
      if (depth === 0) {
        const jsonCandidate = trimmed.slice(startIndex, i + 1)
        try {
          return JSON.parse(jsonCandidate) as T
        } catch {
          return null
        }
      }
    }
  }

  return null
}

/**
 * Truncate text to a maximum length, breaking at a word boundary.
 * Appends an ellipsis indicator if truncation occurs.
 *
 * Useful for fitting content into prompt token budgets.
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text ?? ''
  }

  if (maxLength <= 0) {
    return ''
  }

  // Reserve space for the truncation indicator
  const indicator = '... [truncated]'
  const targetLength = maxLength - indicator.length

  if (targetLength <= 0) {
    return text.slice(0, maxLength)
  }

  // Find the last space before the target length to avoid cutting words
  const truncated = text.slice(0, targetLength)
  const lastSpace = truncated.lastIndexOf(' ')

  if (lastSpace > targetLength * 0.8) {
    // Only break at word boundary if we don't lose too much text
    return truncated.slice(0, lastSpace) + indicator
  }

  return truncated + indicator
}

/**
 * Rough estimation of token count for a given text.
 *
 * Uses the approximation that 1 token is roughly 4 characters for English text.
 * This is intentionally conservative (overestimates) to avoid hitting token limits.
 *
 * For precise token counting, use the official tokenizer library.
 * This function is suitable for quick budget checks before making API calls.
 */
export function estimateTokens(text: string): number {
  if (!text) {
    return 0
  }

  // Average ratio for English text: ~4 characters per token
  // We use 3.5 to be slightly conservative (overestimate token count)
  const charBasedEstimate = Math.ceil(text.length / 3.5)

  // Also factor in whitespace-separated words as a secondary heuristic.
  // Tokens often align with words, but many words split into multiple tokens.
  // Average ~1.3 tokens per word for typical English text.
  const words = text.split(/\s+/).filter(Boolean).length
  const wordBasedEstimate = Math.ceil(words * 1.3)

  // Return the higher estimate to be conservative
  return Math.max(charBasedEstimate, wordBasedEstimate)
}
