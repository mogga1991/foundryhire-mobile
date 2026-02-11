import { describe, it, expect } from 'vitest'
import { randomUUID } from 'crypto'

/**
 * Unit tests for resume upload validation logic
 * Tests extension whitelisting, file size validation, and UUID filename generation
 */

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx'] as const
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Helper function to validate extension (mimics route logic)
function validateExtension(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop()
  return ext !== undefined && ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number])
}

// Helper function to validate file size
function validateFileSize(size: number): boolean {
  return size <= MAX_FILE_SIZE
}

// Helper function to generate safe filename (mimics route logic)
function generateSafeFilename(candidateId: string, filename: string): string | null {
  const ext = filename.toLowerCase().split('.').pop()
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number])) {
    return null
  }
  return `${candidateId}-${randomUUID()}.${ext}`
}

describe('Resume Upload Validation', () => {
  describe('Extension validation', () => {
    it('should accept valid PDF extension', () => {
      expect(validateExtension('resume.pdf')).toBe(true)
      expect(validateExtension('Resume.PDF')).toBe(true)
      expect(validateExtension('my-resume.pdf')).toBe(true)
    })

    it('should accept valid DOC extension', () => {
      expect(validateExtension('resume.doc')).toBe(true)
      expect(validateExtension('Resume.DOC')).toBe(true)
    })

    it('should accept valid DOCX extension', () => {
      expect(validateExtension('resume.docx')).toBe(true)
      expect(validateExtension('Resume.DOCX')).toBe(true)
      expect(validateExtension('my-resume.docx')).toBe(true)
    })

    it('should reject invalid extensions', () => {
      expect(validateExtension('malware.exe')).toBe(false)
      expect(validateExtension('script.php')).toBe(false)
      expect(validateExtension('code.js')).toBe(false)
      expect(validateExtension('shell.sh')).toBe(false)
      expect(validateExtension('archive.zip')).toBe(false)
    })

    it('should reject double extensions', () => {
      expect(validateExtension('resume.pdf.exe')).toBe(false)
      expect(validateExtension('document.docx.php')).toBe(false)
    })

    it('should reject files with no extension', () => {
      expect(validateExtension('resume')).toBe(false)
      expect(validateExtension('noextension')).toBe(false)
    })

    it('should reject empty filename', () => {
      expect(validateExtension('')).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(validateExtension('.pdf')).toBe(true) // Hidden file with valid extension
      expect(validateExtension('file.')).toBe(false) // Ends with dot but no extension
      expect(validateExtension('.')).toBe(false) // Just a dot
    })
  })

  describe('File size validation', () => {
    it('should accept files under 10MB', () => {
      expect(validateFileSize(1024)).toBe(true) // 1KB
      expect(validateFileSize(1024 * 1024)).toBe(true) // 1MB
      expect(validateFileSize(5 * 1024 * 1024)).toBe(true) // 5MB
      expect(validateFileSize(MAX_FILE_SIZE - 1)).toBe(true) // Just under limit
    })

    it('should accept file exactly at 10MB', () => {
      expect(validateFileSize(MAX_FILE_SIZE)).toBe(true)
    })

    it('should reject files over 10MB', () => {
      expect(validateFileSize(MAX_FILE_SIZE + 1)).toBe(false)
      expect(validateFileSize(15 * 1024 * 1024)).toBe(false) // 15MB
      expect(validateFileSize(100 * 1024 * 1024)).toBe(false) // 100MB
    })

    it('should handle zero file size', () => {
      // Zero-byte files are technically valid (empty files)
      expect(validateFileSize(0)).toBe(true)
    })
  })

  describe('UUID filename generation', () => {
    const candidateId = 'test-candidate-123'

    it('should generate safe filenames with UUID for valid extensions', () => {
      const pdfName = generateSafeFilename(candidateId, 'resume.pdf')
      expect(pdfName).toBeTruthy()
      expect(pdfName).toMatch(/^test-candidate-123-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/)

      const docxName = generateSafeFilename(candidateId, 'resume.docx')
      expect(docxName).toBeTruthy()
      expect(docxName).toMatch(/^test-candidate-123-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.docx$/)
    })

    it('should return null for invalid extensions', () => {
      expect(generateSafeFilename(candidateId, 'malware.exe')).toBe(null)
      expect(generateSafeFilename(candidateId, 'script.js')).toBe(null)
      expect(generateSafeFilename(candidateId, 'resume.pdf.exe')).toBe(null)
    })

    it('should generate unique filenames for same input', () => {
      const name1 = generateSafeFilename(candidateId, 'resume.pdf')
      const name2 = generateSafeFilename(candidateId, 'resume.pdf')

      expect(name1).toBeTruthy()
      expect(name2).toBeTruthy()
      expect(name1).not.toBe(name2) // UUIDs should be different
    })

    it('should preserve extension case as lowercase', () => {
      const pdfName = generateSafeFilename(candidateId, 'Resume.PDF')
      expect(pdfName).toBeTruthy()
      expect(pdfName).toMatch(/\.pdf$/) // Should be lowercase
    })

    it('should sanitize original filename completely', () => {
      const maliciousName = '../../../etc/passwd.pdf'
      const safeName = generateSafeFilename(candidateId, maliciousName)

      expect(safeName).toBeTruthy()
      expect(safeName).not.toContain('..')
      expect(safeName).not.toContain('/')
      expect(safeName).toMatch(/^test-candidate-123-[0-9a-f-]{36}\.pdf$/)
    })

    it('should handle special characters in original filename', () => {
      const specialName = "my resume's file (final) [v2].pdf"
      const safeName = generateSafeFilename(candidateId, specialName)

      expect(safeName).toBeTruthy()
      expect(safeName).toMatch(/^test-candidate-123-[0-9a-f-]{36}\.pdf$/)
      expect(safeName).not.toContain("'")
      expect(safeName).not.toContain(' ')
      expect(safeName).not.toContain('(')
      expect(safeName).not.toContain(')')
    })
  })
})
