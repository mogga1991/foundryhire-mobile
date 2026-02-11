import { generateJSON } from '@/lib/ai/claude'
import { estimateTokens, truncateText } from '@/lib/ai/utils'
import { createLogger } from '@/lib/logger'
import {
  buildEnhancedInterviewAnalysisPrompt,
  type EnhancedInterviewAnalysis,
} from '@/lib/ai/prompts/interview-analysis'
import { getCachedAnalysis, setCachedAnalysis } from '@/lib/ai/cache'

const logger = createLogger('interview-scoring')

export interface JobContext {
  title: string
  requirements: string[]
}

export interface CandidateContext {
  name: string
  resume?: string
}

/**
 * Analyze an interview transcript with enhanced scoring and evidence-based assessment
 */
export async function analyzeInterview(
  transcript: string,
  jobContext?: JobContext,
  candidateContext?: CandidateContext
): Promise<EnhancedInterviewAnalysis> {
  // Validate input
  if (!transcript || transcript.trim().length < 50) {
    logger.warn({ message: 'Transcript too short for analysis' })
    throw new Error('Transcript must be at least 50 characters for analysis')
  }

  // Check cache first
  const cacheContext = { jobContext, candidateContext }
  const cached = getCachedAnalysis<EnhancedInterviewAnalysis>(transcript, cacheContext)
  if (cached) {
    logger.info('Returning cached interview analysis')
    return cached
  }

  // Estimate tokens and truncate if needed
  const maxTranscriptTokens = 6000
  const estimatedTokens = estimateTokens(transcript)

  let processedTranscript = transcript
  if (estimatedTokens > maxTranscriptTokens) {
    logger.info({ message: `Transcript too long (${estimatedTokens} tokens), truncating to ${maxTranscriptTokens} tokens` })
    // Approximate character count for target tokens (4 chars per token)
    const maxChars = maxTranscriptTokens * 4
    processedTranscript = truncateText(transcript, maxChars)
  }

  // Build context for prompt
  const context = {
    candidateName: candidateContext?.name,
    jobTitle: jobContext?.title,
    jobRequirements: jobContext?.requirements,
    candidateResume: candidateContext?.resume
      ? truncateText(candidateContext.resume, 1000) // Limit resume to ~250 tokens
      : undefined,
  }

  // Build prompt and call Claude
  const prompt = buildEnhancedInterviewAnalysisPrompt(processedTranscript, context)

  logger.info({
    message: 'Running enhanced interview analysis',
    candidateName: candidateContext?.name,
    jobTitle: jobContext?.title,
    transcriptLength: processedTranscript.length
  })

  const analysis = await generateJSON<EnhancedInterviewAnalysis>(prompt, 5000)

  // Validate response structure
  if (!analysis.summary || !analysis.competencyScores || !analysis.recommendation) {
    logger.error({ message: 'Invalid interview analysis response structure' })
    throw new Error('Failed to parse interview analysis response')
  }

  // Ensure all competency scores have evidence arrays
  const competencies = ['technical', 'communication', 'problemSolving', 'leadership', 'domainExpertise', 'cultureFit', 'adaptability'] as const
  for (const competency of competencies) {
    if (!analysis.competencyScores[competency]?.evidence) {
      logger.warn({ message: `Missing evidence for ${competency}, adding empty array` })
      if (!analysis.competencyScores[competency]) {
        analysis.competencyScores[competency] = { score: 50, evidence: [] }
      } else {
        analysis.competencyScores[competency].evidence = []
      }
    }
  }

  logger.info({
    message: 'Enhanced interview analysis complete',
    recommendation: analysis.recommendation,
    confidence: analysis.recommendationConfidence,
    sentimentScore: analysis.sentimentScore
  })

  // Cache the result
  setCachedAnalysis(processedTranscript, cacheContext, analysis)

  return analysis
}
