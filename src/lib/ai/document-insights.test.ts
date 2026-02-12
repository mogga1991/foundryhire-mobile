import { describe, expect, it } from 'vitest'
import { generateDocumentInsights } from './document-insights'

describe('generateDocumentInsights', () => {
  it('returns bounded score and at least one insight', () => {
    const result = generateDocumentInsights({
      documentType: 'resume',
      fileName: 'candidate-resume.pdf',
      fileSizeBytes: 250_000,
    })

    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.insights.length).toBeGreaterThan(0)
  })

  it('penalizes very small files', () => {
    const result = generateDocumentInsights({
      documentType: 'license',
      fileName: 'license.pdf',
      fileSizeBytes: 10_000,
    })

    expect(result.insights.join(' ')).toContain('small')
  })
})
