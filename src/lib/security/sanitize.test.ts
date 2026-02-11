import { describe, it, expect } from 'vitest'
import {
  sanitizeUserInput,
  sanitizeHtml,
  sanitizeForDb,
  sanitizeFilename,
  sanitizeUrl,
  sanitizeEmail,
  sanitizePhoneNumber,
  sanitizeObject,
} from '@/lib/security/sanitize'

// ---------------------------------------------------------------------------
// Tests: sanitizeUserInput
// ---------------------------------------------------------------------------

describe('sanitizeUserInput', () => {
  it('should preserve normal text', () => {
    const input = 'Hello, this is normal text.'
    const result = sanitizeUserInput(input)
    expect(result).toBe('Hello, this is normal text.')
  })

  it('should trim whitespace', () => {
    const result = sanitizeUserInput('  Hello World  ')
    expect(result).toBe('Hello World')
  })

  it('should handle null gracefully', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = sanitizeUserInput(null as any)
    expect(result).toBe('')
  })

  it('should handle undefined gracefully', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = sanitizeUserInput(undefined as any)
    expect(result).toBe('')
  })

  it('should handle empty string', () => {
    const result = sanitizeUserInput('')
    expect(result).toBe('')
  })

  it('should handle non-string types gracefully', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = sanitizeUserInput(123 as any)
    expect(result).toBe('')
  })

  it('should enforce maxLength option', () => {
    const input = 'This is a long string that should be truncated.'
    const result = sanitizeUserInput(input, { maxLength: 10 })
    expect(result).toHaveLength(10)
    expect(result).toBe('This is a ')
  })

  it('should remove control characters by default', () => {
    const input = 'Hello\x00World\x01Test\x1F'
    const result = sanitizeUserInput(input)
    expect(result).toBe('HelloWorldTest')
    expect(result).not.toMatch(/[\x00-\x1F]/)
  })

  it('should remove newlines and tabs by default', () => {
    const input = 'Hello\nWorld\tTest'
    const result = sanitizeUserInput(input)
    expect(result).not.toContain('\n')
    expect(result).not.toContain('\t')
  })

  it('should preserve newlines and tabs when allowNewlines is true', () => {
    const input = 'Hello\nWorld\tTest'
    const result = sanitizeUserInput(input, { allowNewlines: true })
    expect(result).toContain('\n')
    expect(result).toContain('\t')
  })

  it('should still remove null bytes even with allowNewlines', () => {
    const input = 'Hello\x00World'
    const result = sanitizeUserInput(input, { allowNewlines: true })
    expect(result).toBe('HelloWorld')
  })

  it('should apply maxLength after removing control characters', () => {
    const input = '\x00\x01Hello World'
    const result = sanitizeUserInput(input, { maxLength: 5 })
    expect(result).toBe('Hello')
  })
})

// ---------------------------------------------------------------------------
// Tests: sanitizeHtml
// ---------------------------------------------------------------------------

describe('sanitizeHtml', () => {
  it('should strip HTML tags', () => {
    const input = '<p>Hello <b>World</b></p>'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('<p>')
    expect(result).not.toContain('</p>')
    expect(result).not.toContain('<b>')
    expect(result).not.toContain('</b>')
    expect(result).toContain('Hello')
    expect(result).toContain('World')
  })

  it('should strip script tags', () => {
    const input = '<script>alert("xss")</script>Hello'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('</script>')
    expect(result).toContain('Hello')
  })

  it('should escape HTML entities after stripping tags', () => {
    const input = 'A & B'
    const result = sanitizeHtml(input)
    expect(result).toContain('&amp;')

    // Test that standalone angle brackets get stripped as potential tags
    const inputWithBrackets = 'Text <script>alert(1)</script> more'
    const resultWithBrackets = sanitizeHtml(inputWithBrackets)
    expect(resultWithBrackets).toBe('Text alert(1) more')
  })

  it('should handle null/undefined gracefully', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeHtml(null as any)).toBe('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeHtml(undefined as any)).toBe('')
    expect(sanitizeHtml('')).toBe('')
  })

  it('should handle self-closing tags', () => {
    const input = 'Hello<br/>World<img src="x"/>'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('<')
    expect(result).not.toContain('>')
  })
})

// ---------------------------------------------------------------------------
// Tests: sanitizeForDb
// ---------------------------------------------------------------------------

describe('sanitizeForDb', () => {
  it('should remove null bytes', () => {
    const input = 'Hello\x00World'
    const result = sanitizeForDb(input)
    expect(result).toBe('HelloWorld')
  })

  it('should remove SQL comment patterns', () => {
    const input = 'SELECT /* drop table */ * FROM users'
    const result = sanitizeForDb(input)
    expect(result).not.toContain('/* drop table */')
  })

  it('should trim the result', () => {
    const result = sanitizeForDb('  Hello World  ')
    expect(result).toBe('Hello World')
  })

  it('should handle empty and null inputs', () => {
    expect(sanitizeForDb('')).toBe('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeForDb(null as any)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Tests: sanitizeFilename
// ---------------------------------------------------------------------------

describe('sanitizeFilename', () => {
  it('should remove directory traversal characters', () => {
    const result = sanitizeFilename('../../../etc/passwd')
    expect(result).not.toContain('/')
    expect(result).not.toContain('..')
  })

  it('should remove backslashes', () => {
    const result = sanitizeFilename('..\\..\\windows\\system32')
    expect(result).not.toContain('\\')
  })

  it('should remove leading/trailing dots', () => {
    const result = sanitizeFilename('...hidden.txt...')
    expect(result).not.toMatch(/^\./)
    expect(result).not.toMatch(/\.$/)
  })

  it('should limit length to 255 characters', () => {
    const longName = 'a'.repeat(300) + '.txt'
    const result = sanitizeFilename(longName)
    expect(result.length).toBeLessThanOrEqual(255)
  })

  it('should handle empty/null inputs', () => {
    expect(sanitizeFilename('')).toBe('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeFilename(null as any)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Tests: sanitizeUrl
// ---------------------------------------------------------------------------

describe('sanitizeUrl', () => {
  it('should allow https URLs', () => {
    const url = 'https://example.com/page'
    expect(sanitizeUrl(url)).toBe(url)
  })

  it('should allow http URLs', () => {
    const url = 'http://example.com/page'
    expect(sanitizeUrl(url)).toBe(url)
  })

  it('should block javascript: URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('')
  })

  it('should block data: URLs', () => {
    expect(sanitizeUrl('data:text/html,<h1>XSS</h1>')).toBe('')
  })

  it('should block vbscript: URLs', () => {
    expect(sanitizeUrl('vbscript:msgbox("xss")')).toBe('')
  })

  it('should block file: URLs', () => {
    expect(sanitizeUrl('file:///etc/passwd')).toBe('')
  })

  it('should allow relative URLs', () => {
    expect(sanitizeUrl('/path/to/page')).toBe('/path/to/page')
  })

  it('should handle empty/null inputs', () => {
    expect(sanitizeUrl('')).toBe('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeUrl(null as any)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Tests: sanitizeEmail
// ---------------------------------------------------------------------------

describe('sanitizeEmail', () => {
  it('should accept valid email addresses', () => {
    expect(sanitizeEmail('user@example.com')).toBe('user@example.com')
  })

  it('should lowercase the email', () => {
    expect(sanitizeEmail('User@Example.COM')).toBe('user@example.com')
  })

  it('should reject invalid emails', () => {
    expect(sanitizeEmail('not-an-email')).toBe('')
    expect(sanitizeEmail('missing@domain')).toBe('')
  })

  it('should handle empty/null inputs', () => {
    expect(sanitizeEmail('')).toBe('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeEmail(null as any)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Tests: sanitizePhoneNumber
// ---------------------------------------------------------------------------

describe('sanitizePhoneNumber', () => {
  it('should keep valid phone number characters', () => {
    expect(sanitizePhoneNumber('+1 (555) 123-4567')).toBe('+1 (555) 123-4567')
  })

  it('should strip invalid characters', () => {
    expect(sanitizePhoneNumber('+1-555-ABC-1234')).toBe('+1-555--1234')
  })

  it('should handle empty/null inputs', () => {
    expect(sanitizePhoneNumber('')).toBe('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizePhoneNumber(null as any)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Tests: sanitizeObject
// ---------------------------------------------------------------------------

describe('sanitizeObject', () => {
  it('should sanitize specified string fields', () => {
    const obj = { name: '  Hello\x00  ', age: 25, email: 'test@example.com' }
    const result = sanitizeObject(obj, ['name'])
    expect(result.name).toBe('Hello')
    expect(result.age).toBe(25)
  })

  it('should not modify fields not in the specified list', () => {
    const obj = { name: '  Hello  ', description: '  World  ' }
    const result = sanitizeObject(obj, ['name'])
    expect(result.description).toBe('  World  ')
  })

  it('should skip non-string fields even if listed', () => {
    const obj = { name: 'Hello', count: 42 }
    const result = sanitizeObject(obj, ['name', 'count'])
    expect(result.count).toBe(42)
  })
})
