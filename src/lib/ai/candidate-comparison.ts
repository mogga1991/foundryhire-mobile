import { generateJSON } from '@/lib/ai/claude'
import { createLogger } from '@/lib/logger'
import {
  buildCandidateComparisonPrompt,
  type CandidateForComparison,
  type JobContext,
} from '@/lib/ai/prompts/candidate-comparison'

const logger = createLogger('candidate-comparison')

export interface CandidateRanking {
  rank: number
  candidateId: string
  candidateName: string
  overallFitScore: number
  competencyComparison: Record<
    string,
    {
      score: number
      relativeStrength: 'strongest' | 'above_average' | 'average' | 'below_average' | 'weakest'
    }
  >
  strengths: string[]
  concerns: string[]
  recommendation: string
}

export interface CandidateComparison {
  jobId?: string
  generatedAt: string
  rankings: CandidateRanking[]
  comparativeInsights: string[]
  hiringRecommendation: string
  diversityConsiderations: string
}

/**
 * Compare and rank multiple candidates based on their interview analyses
 */
export async function compareCandidates(
  candidates: CandidateForComparison[],
  jobContext?: JobContext
): Promise<CandidateComparison> {
  // Validate input
  if (!candidates || !Array.isArray(candidates)) {
    logger.warn({ message: 'Invalid candidates array provided' })
    throw new Error('Valid candidates array is required for comparison')
  }

  if (candidates.length < 2) {
    logger.warn({
      message: 'At least 2 candidates required for comparison',
      candidateCount: candidates.length,
    })
    throw new Error('At least 2 candidates are required for comparison')
  }

  if (candidates.length > 10) {
    logger.warn({
      message: 'Too many candidates for comparison',
      candidateCount: candidates.length,
    })
    throw new Error('Maximum 10 candidates can be compared at once')
  }

  // Validate each candidate has required fields
  for (const candidate of candidates) {
    if (
      !candidate.candidateId ||
      !candidate.candidateName ||
      !candidate.interviewId ||
      !candidate.competencyScores
    ) {
      logger.error({ message: 'Invalid candidate data', candidate })
      throw new Error(
        'Each candidate must have candidateId, candidateName, interviewId, and competencyScores'
      )
    }
  }

  // Build prompt
  const prompt = buildCandidateComparisonPrompt(candidates, jobContext)

  logger.info({
    message: 'Starting candidate comparison',
    candidateCount: candidates.length,
    jobTitle: jobContext?.title,
  })

  // Call Claude to generate comparison
  const comparison = await generateJSON<CandidateComparison>(prompt, 5000)

  // Validate response structure
  if (!comparison.rankings || !Array.isArray(comparison.rankings)) {
    logger.error({ message: 'Invalid comparison response structure' })
    throw new Error('Failed to generate valid candidate comparison')
  }

  if (comparison.rankings.length !== candidates.length) {
    logger.warn({
      message: 'Ranking count mismatch',
      expected: candidates.length,
      actual: comparison.rankings.length,
    })
  }

  // Validate rankings have proper rank order (1, 2, 3, ...)
  const ranks = comparison.rankings.map((r) => r.rank).sort((a, b) => a - b)
  const expectedRanks = Array.from({ length: candidates.length }, (_, i) => i + 1)
  const ranksValid = JSON.stringify(ranks) === JSON.stringify(expectedRanks)

  if (!ranksValid) {
    logger.warn({ message: 'Invalid ranking order', ranks, expectedRanks })
  }

  // Ensure diversity considerations are present
  if (!comparison.diversityConsiderations || comparison.diversityConsiderations.trim().length < 20) {
    logger.warn({ message: 'Missing or insufficient diversity considerations' })
    comparison.diversityConsiderations =
      'Review this analysis for any unconscious bias. Consider diverse perspectives and experiences as strengths. Ensure the interview process was fair and consistent across all candidates. Make hiring decisions based on job-relevant factors and demonstrated competencies only.'
  }

  logger.info({
    message: 'Candidate comparison completed',
    candidateCount: candidates.length,
    topCandidate: comparison.rankings[0]?.candidateName,
    topCandidateScore: comparison.rankings[0]?.overallFitScore,
  })

  return comparison
}

// Re-export types for convenience
export type { CandidateForComparison, JobContext }
