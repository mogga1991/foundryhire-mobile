import { generateJSON } from '@/lib/ai/claude'
import { createLogger } from '@/lib/logger'
import {
  buildConsensusPrompt,
  type InterviewerFeedback,
  type JobContext,
} from '@/lib/ai/prompts/consensus-scoring'

const logger = createLogger('consensus-scoring')

export interface ConsensusResult {
  interviewId: string
  generatedAt: string
  overallScore: number // weighted average 0-100
  consensusRecommendation: 'strong_hire' | 'hire' | 'maybe' | 'no_hire'
  confidence: number // 0-100, lower if there's disagreement

  // Disagreement analysis
  hasSignificantDisagreement: boolean
  disagreementAreas: Array<{
    area: string
    interviewerPositions: Array<{ name: string; position: string }>
    resolution: string
  }>

  // Synthesized feedback
  commonStrengths: string[]
  commonConcerns: string[]
  uniqueInsights: Array<{ interviewer: string; insight: string }>

  // Per-interviewer summary
  interviewerSummaries: Array<{
    name: string
    role: string
    rating: number
    recommendation: string
    weight: number
    keyPoints: string[]
  }>

  // AI-generated narrative
  narrativeSummary: string // 2-3 paragraph synthesis
  hiringDecisionRationale: string // Clear reasoning for the recommendation

  // Calibration data
  calibrationNotes?: string // Notes on interviewer alignment
}

/**
 * Calculate weight based on interviewer role
 */
function getInterviewerWeight(role: string): number {
  const normalizedRole = role.toLowerCase()

  if (normalizedRole.includes('hiring_manager') || normalizedRole.includes('hiring manager')) {
    return 1.5
  }
  if (normalizedRole.includes('recruiter')) {
    return 0.8
  }
  if (normalizedRole.includes('observer')) {
    return 0.5
  }
  // Default for 'interviewer' or any other role
  return 1.0
}

/**
 * Calculate weighted average score from feedback entries
 */
function calculateWeightedScore(feedbackEntries: InterviewerFeedback[]): number {
  let totalWeightedScore = 0
  let totalWeight = 0

  for (const feedback of feedbackEntries) {
    const weight = getInterviewerWeight(feedback.role)
    // Convert 1-10 rating to 0-100 scale: (rating - 1) * 11.11
    const normalizedScore = (feedback.rating - 1) * 11.11
    totalWeightedScore += normalizedScore * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0
}

/**
 * Detect significant disagreements in ratings and recommendations
 */
function detectDisagreements(feedbackEntries: InterviewerFeedback[]): boolean {
  if (feedbackEntries.length < 2) {
    return false
  }

  const ratings = feedbackEntries.map((f) => f.rating)
  const recommendations = feedbackEntries.map((f) => f.recommendation)

  const maxRating = Math.max(...ratings)
  const minRating = Math.min(...ratings)

  // Flag if rating spread > 3
  if (maxRating - minRating > 3) {
    return true
  }

  // Flag if recommendations don't align
  const recommendationSet = new Set(recommendations)
  if (recommendationSet.size > 1) {
    // Check if there's a hire vs no_hire split (significant disagreement)
    const hasHireRecommendation = recommendations.some(
      (r) => r === 'hire' || r === 'strong_hire'
    )
    const hasNoHireRecommendation = recommendations.some((r) => r === 'no_hire')

    if (hasHireRecommendation && hasNoHireRecommendation) {
      return true
    }
  }

  return false
}

/**
 * Generate consensus score from multiple interviewer feedback entries
 */
export async function generateConsensusScore(
  interviewId: string,
  feedbackEntries: InterviewerFeedback[],
  aiAnalysis?: string,
  jobContext?: JobContext
): Promise<ConsensusResult> {
  // Validate input
  if (!feedbackEntries || feedbackEntries.length < 2) {
    logger.warn({ message: 'Insufficient feedback entries for consensus', interviewId })
    throw new Error('At least 2 feedback entries are required for consensus scoring')
  }

  // Fill in defaults for missing fields
  const processedFeedback = feedbackEntries.map((feedback) => ({
    ...feedback,
    confidenceLevel: feedback.confidenceLevel || 3,
    competencyRatings: feedback.competencyRatings || {},
  }))

  // Calculate preliminary metrics
  const weightedScore = calculateWeightedScore(processedFeedback)
  const hasDisagreement = detectDisagreements(processedFeedback)

  logger.info({
    message: 'Generating consensus score',
    interviewId,
    feedbackCount: processedFeedback.length,
    weightedScore,
    hasDisagreement,
  })

  try {
    // Build prompt and call Claude
    const prompt = buildConsensusPrompt(processedFeedback, aiAnalysis, jobContext)

    const analysis = await generateJSON<ConsensusResult>(prompt, 5000)

    // Set system-generated fields
    analysis.interviewId = interviewId
    analysis.generatedAt = new Date().toISOString()

    // Validate response structure
    if (
      !analysis.consensusRecommendation ||
      !analysis.narrativeSummary ||
      !analysis.hiringDecisionRationale
    ) {
      logger.error({ message: 'Invalid consensus analysis response structure', interviewId })
      throw new Error('Failed to parse consensus analysis response')
    }

    // Ensure all required arrays exist
    analysis.commonStrengths = analysis.commonStrengths || []
    analysis.commonConcerns = analysis.commonConcerns || []
    analysis.uniqueInsights = analysis.uniqueInsights || []
    analysis.disagreementAreas = analysis.disagreementAreas || []
    analysis.interviewerSummaries = analysis.interviewerSummaries || []

    // Fill in interviewer summaries with calculated weights if missing
    if (analysis.interviewerSummaries.length === 0) {
      analysis.interviewerSummaries = processedFeedback.map((feedback) => ({
        name: feedback.interviewerName,
        role: feedback.role,
        rating: feedback.rating,
        recommendation: feedback.recommendation,
        weight: getInterviewerWeight(feedback.role),
        keyPoints: [],
      }))
    }

    logger.info({
      message: 'Consensus analysis complete',
      interviewId,
      recommendation: analysis.consensusRecommendation,
      confidence: analysis.confidence,
      hasSignificantDisagreement: analysis.hasSignificantDisagreement,
    })

    return analysis
  } catch (error) {
    logger.error({ message: 'Consensus scoring failed', interviewId, error })

    // Return partial result with just weighted averages (fallback)
    const fallbackResult: ConsensusResult = {
      interviewId,
      generatedAt: new Date().toISOString(),
      overallScore: weightedScore,
      consensusRecommendation: weightedScore >= 70 ? 'hire' : weightedScore >= 50 ? 'maybe' : 'no_hire',
      confidence: hasDisagreement ? 40 : 60,
      hasSignificantDisagreement: hasDisagreement,
      disagreementAreas: [],
      commonStrengths: [],
      commonConcerns: [],
      uniqueInsights: [],
      interviewerSummaries: processedFeedback.map((feedback) => ({
        name: feedback.interviewerName,
        role: feedback.role,
        rating: feedback.rating,
        recommendation: feedback.recommendation,
        weight: getInterviewerWeight(feedback.role),
        keyPoints: [],
      })),
      narrativeSummary: 'AI analysis temporarily unavailable. Using weighted average scoring.',
      hiringDecisionRationale: `Based on weighted average score of ${weightedScore}/100 from ${processedFeedback.length} interviewers.`,
      calibrationNotes: error instanceof Error ? `Error: ${error.message}` : undefined,
    }

    return fallbackResult
  }
}

export type { InterviewerFeedback, JobContext }
