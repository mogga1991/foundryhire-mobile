import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyzeBias, buildBiasDetectionPrompt, type BiasAnalysis } from '@/lib/ai/bias-detection'
import { generateMockTranscript } from '@/test/helpers'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/ai/claude', () => ({
  generateJSON: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@/lib/ai/cache', () => ({
  getCachedAnalysis: vi.fn(() => undefined),
  setCachedAnalysis: vi.fn(),
  clearCache: vi.fn(),
}))

import { generateJSON } from '@/lib/ai/claude'

const mockedGenerateJSON = vi.mocked(generateJSON)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createValidBiasAnalysis(overrides?: Partial<BiasAnalysis>): BiasAnalysis {
  return {
    overallRiskLevel: 'low',
    overallScore: 92,
    categories: {
      genderBias: { score: 95, flags: [], examples: [] },
      racialBias: { score: 90, flags: [], examples: [] },
      ageBias: { score: 88, flags: ['Minor age-related question'], examples: ['What year did you graduate?'] },
      disabilityBias: { score: 95, flags: [], examples: [] },
      socioeconomicBias: { score: 92, flags: [], examples: [] },
    },
    flaggedPhrases: [
      {
        phrase: 'What year did you graduate?',
        category: 'ageBias',
        severity: 'low',
        suggestion: 'Ask about qualifications rather than graduation year.',
      },
    ],
    recommendations: [
      'Avoid questions that can be used to infer age.',
      'Continue using structured interview format.',
      'Focus questions on job-relevant competencies.',
    ],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests: analyzeBias
// ---------------------------------------------------------------------------

describe('analyzeBias', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should throw when transcript is shorter than 50 characters', async () => {
    const shortTranscript = 'Hi, nice to meet you.'

    await expect(analyzeBias(shortTranscript)).rejects.toThrow(
      'Transcript must be at least 50 characters for bias analysis'
    )

    expect(mockedGenerateJSON).not.toHaveBeenCalled()
  })

  it('should throw when transcript is empty', async () => {
    await expect(analyzeBias('')).rejects.toThrow(
      'Transcript must be at least 50 characters for bias analysis'
    )
  })

  it('should throw when transcript is only whitespace', async () => {
    const whitespace = '   '.repeat(30)
    await expect(analyzeBias(whitespace)).rejects.toThrow(
      'Transcript must be at least 50 characters for bias analysis'
    )
  })

  it('should truncate transcripts exceeding 6000 token estimate', async () => {
    const longTranscript = generateMockTranscript({ lengthChars: 30000 })
    const validResponse = createValidBiasAnalysis()
    mockedGenerateJSON.mockResolvedValueOnce(validResponse)

    await analyzeBias(longTranscript)

    // Verify the prompt passed to generateJSON is shorter than the raw transcript
    const calledPrompt = mockedGenerateJSON.mock.calls[0][0] as string
    // The prompt includes the template text plus the (truncated) transcript
    // The transcript portion should be at most 24000 chars (6000 tokens * 4 chars/token)
    expect(calledPrompt.length).toBeLessThan(longTranscript.length + 5000)
  })

  it('should throw when response is missing overallRiskLevel', async () => {
    const transcript = generateMockTranscript({ lengthChars: 200 })
    const invalidResponse = createValidBiasAnalysis()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(invalidResponse as any).overallRiskLevel = ''

    mockedGenerateJSON.mockResolvedValueOnce(invalidResponse)

    await expect(analyzeBias(transcript)).rejects.toThrow(
      'Failed to parse bias analysis response'
    )
  })

  it('should throw when response is missing categories', async () => {
    const transcript = generateMockTranscript({ lengthChars: 200 })
    const invalidResponse = createValidBiasAnalysis()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(invalidResponse as any).categories = null

    mockedGenerateJSON.mockResolvedValueOnce(invalidResponse)

    await expect(analyzeBias(transcript)).rejects.toThrow(
      'Failed to parse bias analysis response'
    )
  })

  it('should return a valid BiasAnalysis on successful analysis', async () => {
    const transcript = generateMockTranscript({ lengthChars: 200 })
    const validResponse = createValidBiasAnalysis()
    mockedGenerateJSON.mockResolvedValueOnce(validResponse)

    const result = await analyzeBias(transcript)

    expect(result.overallRiskLevel).toBe('low')
    expect(result.overallScore).toBe(92)
    expect(result.categories.genderBias.score).toBe(95)
    expect(result.categories.ageBias.flags).toHaveLength(1)
    expect(result.flaggedPhrases).toHaveLength(1)
    expect(result.recommendations).toHaveLength(3)
  })

  it('should call generateJSON with maxTokens of 4000', async () => {
    const transcript = generateMockTranscript({ lengthChars: 200 })
    const validResponse = createValidBiasAnalysis()
    mockedGenerateJSON.mockResolvedValueOnce(validResponse)

    await analyzeBias(transcript)

    expect(mockedGenerateJSON).toHaveBeenCalledWith(expect.any(String), 4000)
  })

  it('should pass interviewer questions to the prompt builder', async () => {
    const transcript = generateMockTranscript({ lengthChars: 200 })
    const validResponse = createValidBiasAnalysis()
    mockedGenerateJSON.mockResolvedValueOnce(validResponse)

    const questions = [
      'Tell me about yourself.',
      'What year did you graduate?',
      'Describe a challenging project.',
    ]

    await analyzeBias(transcript, questions)

    const calledPrompt = mockedGenerateJSON.mock.calls[0][0] as string
    expect(calledPrompt).toContain('INTERVIEWER QUESTIONS')
    expect(calledPrompt).toContain('1. Tell me about yourself.')
    expect(calledPrompt).toContain('2. What year did you graduate?')
    expect(calledPrompt).toContain('3. Describe a challenging project.')
  })

  it('should work without optional interviewer questions', async () => {
    const transcript = generateMockTranscript({ lengthChars: 200 })
    const validResponse = createValidBiasAnalysis()
    mockedGenerateJSON.mockResolvedValueOnce(validResponse)

    const result = await analyzeBias(transcript)

    expect(result).toEqual(validResponse)
    expect(mockedGenerateJSON).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// Tests: buildBiasDetectionPrompt
// ---------------------------------------------------------------------------

describe('buildBiasDetectionPrompt', () => {
  it('should include the transcript in the prompt', () => {
    const transcript = 'This is the interview transcript content.'
    const prompt = buildBiasDetectionPrompt(transcript)

    expect(prompt).toContain('INTERVIEW TRANSCRIPT')
    expect(prompt).toContain(transcript)
  })

  it('should include interviewer questions when provided', () => {
    const transcript = 'This is the interview transcript.'
    const questions = ['Question one?', 'Question two?']
    const prompt = buildBiasDetectionPrompt(transcript, questions)

    expect(prompt).toContain('INTERVIEWER QUESTIONS')
    expect(prompt).toContain('1. Question one?')
    expect(prompt).toContain('2. Question two?')
  })

  it('should not include questions section when questions array is empty', () => {
    const transcript = 'This is the interview transcript.'
    const prompt = buildBiasDetectionPrompt(transcript, [])

    expect(prompt).not.toContain('INTERVIEWER QUESTIONS')
  })

  it('should not include questions section when questions are undefined', () => {
    const transcript = 'This is the interview transcript.'
    const prompt = buildBiasDetectionPrompt(transcript)

    expect(prompt).not.toContain('INTERVIEWER QUESTIONS')
  })

  it('should include analysis instructions for all bias categories', () => {
    const transcript = 'This is the interview transcript.'
    const prompt = buildBiasDetectionPrompt(transcript)

    expect(prompt).toContain('genderBias')
    expect(prompt).toContain('racialBias')
    expect(prompt).toContain('ageBias')
    expect(prompt).toContain('disabilityBias')
    expect(prompt).toContain('socioeconomicBias')
  })
})
