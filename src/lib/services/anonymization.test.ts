import { describe, it, expect } from 'vitest'
import {
  hashEmail,
  anonymizeText,
  anonymizeTranscript,
  anonymizeAIAnalysis,
  sanitizeFeedback,
  sanitizeAISummary,
} from '@/lib/services/anonymization'

// ---------------------------------------------------------------------------
// Tests: hashEmail
// ---------------------------------------------------------------------------

describe('hashEmail', () => {
  it('should produce consistent hashes for the same email', () => {
    const email = 'test@example.com'
    const hash1 = hashEmail(email)
    const hash2 = hashEmail(email)

    expect(hash1).toBe(hash2)
  })

  it('should produce different hashes for different emails', () => {
    const hash1 = hashEmail('alice@example.com')
    const hash2 = hashEmail('bob@example.com')

    expect(hash1).not.toBe(hash2)
  })

  it('should treat email hashing as case-insensitive', () => {
    const hash1 = hashEmail('Test@Example.COM')
    const hash2 = hashEmail('test@example.com')

    expect(hash1).toBe(hash2)
  })

  it('should return an email-like format', () => {
    const hash = hashEmail('user@domain.com')

    expect(hash).toMatch(/^deleted-[a-f0-9]{16}@redacted\.local$/)
  })

  it('should produce a 16-character hex prefix from the SHA-256 hash', () => {
    const hash = hashEmail('any@email.com')
    const prefix = hash.replace('deleted-', '').replace('@redacted.local', '')

    expect(prefix).toHaveLength(16)
    expect(prefix).toMatch(/^[a-f0-9]+$/)
  })
})

// ---------------------------------------------------------------------------
// Tests: anonymizeText
// ---------------------------------------------------------------------------

describe('anonymizeText', () => {
  it('should replace name patterns with [REDACTED]', () => {
    const text = 'Hello John, welcome to the interview.'
    const result = anonymizeText(text, ['John'])

    expect(result).toBe('Hello [REDACTED], welcome to the interview.')
  })

  it('should replace multiple different name patterns', () => {
    const text = 'John Smith applied for the Senior Developer role. John is well qualified.'
    const result = anonymizeText(text, ['John Smith', 'John'])

    expect(result).toContain('[REDACTED]')
    expect(result).not.toContain('John')
  })

  it('should be case-insensitive when matching patterns', () => {
    const text = 'JANE is a great candidate. jane has strong skills.'
    const result = anonymizeText(text, ['Jane'])

    expect(result).not.toMatch(/jane/i)
    expect(result).toContain('[REDACTED]')
  })

  it('should handle empty text gracefully', () => {
    const result = anonymizeText('', ['John'])
    expect(result).toBe('')
  })

  it('should handle null/undefined text gracefully', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = anonymizeText(null as any, ['John'])
    expect(result).toBeNull()
  })

  it('should skip empty patterns in the array', () => {
    const text = 'Hello World'
    const result = anonymizeText(text, ['', '  ', 'World'])

    expect(result).toBe('Hello [REDACTED]')
  })

  it('should match whole words only (word boundary)', () => {
    const text = 'Johnson is different from John.'
    const result = anonymizeText(text, ['John'])

    // "John" at the end should be redacted, but "Johnson" should not
    expect(result).toContain('Johnson')
    expect(result).toContain('[REDACTED]')
  })

  it('should handle special regex characters in patterns', () => {
    const text = 'Dr. Smith (CEO) is here.'
    const result = anonymizeText(text, ['Dr. Smith (CEO)'])

    // The pattern contains regex special chars that should be escaped
    expect(result).toContain('[REDACTED]')
  })
})

// ---------------------------------------------------------------------------
// Tests: anonymizeTranscript
// ---------------------------------------------------------------------------

describe('anonymizeTranscript', () => {
  it('should remove candidate name references from transcript', () => {
    const transcript = 'Interviewer: Hello Jane Smith. Jane, tell me about yourself.\nJane Smith: Sure, I have experience in...'
    const result = anonymizeTranscript(transcript, 'Jane Smith')

    expect(result).not.toContain('Jane Smith')
    expect(result).not.toContain('Jane')
    expect(result).toContain('[REDACTED]')
  })

  it('should handle various name formats', () => {
    const transcript = 'J. Smith joined the meeting. Smith, Jane said hello.'
    const result = anonymizeTranscript(transcript, 'Jane Smith')

    expect(result).not.toContain('J. Smith')
    expect(result).not.toContain('Smith, Jane')
  })

  it('should handle empty transcript', () => {
    const result = anonymizeTranscript('', 'Jane Smith')
    expect(result).toBe('')
  })

  it('should handle empty candidate name', () => {
    const transcript = 'Hello world'
    const result = anonymizeTranscript(transcript, '')
    expect(result).toBe('Hello world')
  })

  it('should handle null transcript', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = anonymizeTranscript(null as any, 'Jane')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Tests: generateNamePatterns (tested indirectly via anonymizeTranscript)
// ---------------------------------------------------------------------------

describe('generateNamePatterns (via anonymizeTranscript)', () => {
  it('should create expected variations: full name', () => {
    const transcript = 'John Doe is here.'
    const result = anonymizeTranscript(transcript, 'John Doe')
    expect(result).not.toContain('John Doe')
  })

  it('should create expected variations: first name only', () => {
    const transcript = 'John is here.'
    const result = anonymizeTranscript(transcript, 'John Doe')
    expect(result).not.toContain('John')
  })

  it('should create expected variations: last name only', () => {
    const transcript = 'Doe submitted the report.'
    const result = anonymizeTranscript(transcript, 'John Doe')
    expect(result).not.toContain('Doe')
  })

  it('should create expected variations: initial + last name (J. Doe)', () => {
    const transcript = 'J. Doe joined the call.'
    const result = anonymizeTranscript(transcript, 'John Doe')
    expect(result).not.toContain('J. Doe')
  })

  it('should create expected variations: first name + last initial (John D.)', () => {
    const transcript = 'John D. is on the line.'
    const result = anonymizeTranscript(transcript, 'John Doe')
    expect(result).not.toContain('John D.')
  })

  it('should create expected variations: last, first format (Doe, John)', () => {
    const transcript = 'Doe, John is the next candidate.'
    const result = anonymizeTranscript(transcript, 'John Doe')
    expect(result).not.toContain('Doe, John')
  })

  it('should handle single name correctly', () => {
    const transcript = 'Madonna performed well in the interview.'
    const result = anonymizeTranscript(transcript, 'Madonna')
    expect(result).not.toContain('Madonna')
    expect(result).toContain('[REDACTED]')
  })
})

// ---------------------------------------------------------------------------
// Tests: anonymizeAIAnalysis
// ---------------------------------------------------------------------------

describe('anonymizeAIAnalysis', () => {
  it('should redact candidate name from AI analysis text', () => {
    const analysis = 'Jane Smith demonstrated strong technical skills. Overall, Jane is recommended.'
    const result = anonymizeAIAnalysis(analysis, 'Jane Smith')

    expect(result).not.toContain('Jane Smith')
    expect(result).not.toContain('Jane')
  })

  it('should handle empty analysis text', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = anonymizeAIAnalysis('' as any, 'Jane Smith')
    expect(result).toBeFalsy()
  })
})

// ---------------------------------------------------------------------------
// Tests: sanitizeFeedback / sanitizeAISummary
// ---------------------------------------------------------------------------

describe('sanitizeFeedback', () => {
  it('should return GDPR deletion message regardless of input', () => {
    const result = sanitizeFeedback('This was a great interview with Jane Smith.')
    expect(result).toBe('Feedback removed per GDPR request')
  })
})

describe('sanitizeAISummary', () => {
  it('should return GDPR deletion message', () => {
    const result = sanitizeAISummary()
    expect(result).toBe('Data removed per GDPR request')
  })
})
