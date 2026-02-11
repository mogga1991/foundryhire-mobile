import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyzeInterview } from '@/lib/ai/interview-scoring'
import type { EnhancedInterviewAnalysis } from '@/lib/ai/prompts/interview-analysis'
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

// Import after mocking so we can control the mock
import { generateJSON } from '@/lib/ai/claude'

const mockedGenerateJSON = vi.mocked(generateJSON)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createValidAnalysis(overrides?: Partial<EnhancedInterviewAnalysis>): EnhancedInterviewAnalysis {
  return {
    summary: 'Strong candidate with solid technical background.',
    sentimentScore: 78,
    competencyScores: {
      technical: { score: 85, evidence: ['Mentioned 8 years of TypeScript experience'] },
      communication: { score: 80, evidence: ['Articulated ideas clearly'] },
      problemSolving: { score: 75, evidence: ['Described migration project'] },
      leadership: { score: 70, evidence: ['Led a team of 5 engineers'] },
      domainExpertise: { score: 72, evidence: ['Deep knowledge of React ecosystem'] },
      cultureFit: { score: 68, evidence: ['Emphasized open communication'] },
      adaptability: { score: 74, evidence: ['Successfully transitioned tech stacks'] },
    },
    strengths: ['Strong technical skills', 'Good leadership qualities', 'Clear communicator'],
    concerns: ['Limited experience with specific domain'],
    recommendation: 'hire',
    recommendationConfidence: 82,
    interviewQuality: {
      questionCoverage: 75,
      candidateEngagement: 80,
      interviewerEffectiveness: 70,
    },
    suggestedFollowUp: ['Ask about system design experience', 'Explore conflict resolution further'],
    keyMoments: [
      {
        timestamp: 'early',
        quote: 'I led a team of 5 engineers building our core platform.',
        significance: 'Demonstrates leadership capability',
        sentiment: 'positive',
      },
    ],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('analyzeInterview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should throw when transcript is shorter than 50 characters', async () => {
    const shortTranscript = 'Hello, how are you?'

    await expect(analyzeInterview(shortTranscript)).rejects.toThrow(
      'Transcript must be at least 50 characters for analysis'
    )

    expect(mockedGenerateJSON).not.toHaveBeenCalled()
  })

  it('should throw when transcript is empty', async () => {
    await expect(analyzeInterview('')).rejects.toThrow(
      'Transcript must be at least 50 characters for analysis'
    )
  })

  it('should throw when transcript is only whitespace', async () => {
    const whitespace = '   '.repeat(50)

    await expect(analyzeInterview(whitespace)).rejects.toThrow(
      'Transcript must be at least 50 characters for analysis'
    )
  })

  it('should truncate transcripts exceeding 6000 token estimate', async () => {
    // Generate a very long transcript (~30000 chars = ~8500 tokens at 3.5 chars/token)
    const longTranscript = generateMockTranscript({ lengthChars: 30000 })

    const validResponse = createValidAnalysis()
    mockedGenerateJSON.mockResolvedValueOnce(validResponse)

    await analyzeInterview(longTranscript)

    // Verify generateJSON was called with a prompt that contains a truncated transcript
    // The truncated transcript should be at most 6000 * 4 = 24000 characters
    const calledPrompt = mockedGenerateJSON.mock.calls[0][0] as string
    // The original longTranscript should NOT appear fully in the prompt
    expect(calledPrompt.length).toBeLessThan(longTranscript.length + 5000) // 5000 for prompt template overhead
  })

  it('should throw when response is missing summary', async () => {
    const transcript = generateMockTranscript({ lengthChars: 200 })
    const invalidResponse = createValidAnalysis()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(invalidResponse as any).summary = ''

    mockedGenerateJSON.mockResolvedValueOnce(invalidResponse)

    await expect(analyzeInterview(transcript)).rejects.toThrow(
      'Failed to parse interview analysis response'
    )
  })

  it('should throw when response is missing competencyScores', async () => {
    const transcript = generateMockTranscript({ lengthChars: 200 })
    const invalidResponse = createValidAnalysis()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(invalidResponse as any).competencyScores = null

    mockedGenerateJSON.mockResolvedValueOnce(invalidResponse)

    await expect(analyzeInterview(transcript)).rejects.toThrow(
      'Failed to parse interview analysis response'
    )
  })

  it('should throw when response is missing recommendation', async () => {
    const transcript = generateMockTranscript({ lengthChars: 200 })
    const invalidResponse = createValidAnalysis()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(invalidResponse as any).recommendation = ''

    mockedGenerateJSON.mockResolvedValueOnce(invalidResponse)

    await expect(analyzeInterview(transcript)).rejects.toThrow(
      'Failed to parse interview analysis response'
    )
  })

  it('should add empty evidence arrays for missing competencies', async () => {
    const transcript = generateMockTranscript({ lengthChars: 200 })
    const partialResponse = createValidAnalysis()
    // Remove evidence from some competencies
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(partialResponse.competencyScores as any).adaptability = { score: 60 }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (partialResponse.competencyScores as any).leadership

    mockedGenerateJSON.mockResolvedValueOnce(partialResponse)

    const result = await analyzeInterview(transcript)

    // adaptability should now have an empty evidence array
    expect(result.competencyScores.adaptability.evidence).toEqual([])
    // leadership should have been created with default values
    expect(result.competencyScores.leadership).toEqual({ score: 50, evidence: [] })
  })

  it('should pass correct context to prompt builder', async () => {
    const transcript = generateMockTranscript({ lengthChars: 200 })
    const validResponse = createValidAnalysis()
    mockedGenerateJSON.mockResolvedValueOnce(validResponse)

    const jobContext = { title: 'Senior Developer', requirements: ['TypeScript', 'React'] }
    const candidateContext = { name: 'Jane Smith', resume: 'Experienced developer with React...' }

    await analyzeInterview(transcript, jobContext, candidateContext)

    const calledPrompt = mockedGenerateJSON.mock.calls[0][0] as string
    expect(calledPrompt).toContain('Jane Smith')
    expect(calledPrompt).toContain('Senior Developer')
    expect(calledPrompt).toContain('TypeScript')
    expect(calledPrompt).toContain('React')
  })

  it('should return a complete EnhancedInterviewAnalysis on successful analysis', async () => {
    const transcript = generateMockTranscript({ lengthChars: 200 })
    const validResponse = createValidAnalysis()
    mockedGenerateJSON.mockResolvedValueOnce(validResponse)

    const result = await analyzeInterview(transcript)

    expect(result.summary).toBe('Strong candidate with solid technical background.')
    expect(result.recommendation).toBe('hire')
    expect(result.recommendationConfidence).toBe(82)
    expect(result.sentimentScore).toBe(78)
    expect(result.competencyScores.technical.score).toBe(85)
    expect(result.competencyScores.communication.score).toBe(80)
    expect(result.strengths).toHaveLength(3)
    expect(result.concerns).toHaveLength(1)
    expect(result.keyMoments).toHaveLength(1)
    expect(result.suggestedFollowUp).toHaveLength(2)
  })

  it('should call generateJSON with maxTokens of 5000', async () => {
    const transcript = generateMockTranscript({ lengthChars: 200 })
    const validResponse = createValidAnalysis()
    mockedGenerateJSON.mockResolvedValueOnce(validResponse)

    await analyzeInterview(transcript)

    expect(mockedGenerateJSON).toHaveBeenCalledWith(expect.any(String), 5000)
  })

  it('should work without optional jobContext and candidateContext', async () => {
    const transcript = generateMockTranscript({ lengthChars: 200 })
    const validResponse = createValidAnalysis()
    mockedGenerateJSON.mockResolvedValueOnce(validResponse)

    const result = await analyzeInterview(transcript)

    expect(result).toEqual(validResponse)
    expect(mockedGenerateJSON).toHaveBeenCalledOnce()
  })
})
