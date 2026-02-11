import { generateJSON } from '@/lib/ai/claude'
import { createLogger } from '@/lib/logger'
import { captureError } from '@/lib/monitoring/sentry'

const logger = createLogger('feedback-synthesis')

export interface FeedbackSynthesis {
  overallSentiment: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative'
  candidateSatisfactionScore: number // 0-100
  interviewExperienceScore: number // 0-100
  keyThemes: string[] // Recurring themes across feedback
  improvementAreas: string[] // What the company could improve
  candidateHighlights: string[] // What candidates appreciated
  comparisonToAverage: {
    score: number // relative to company average, -50 to +50
    trend: 'improving' | 'stable' | 'declining'
  }
  actionableInsights: string[] // Specific suggestions
}

/**
 * Synthesize all feedback for a given interview into AI-powered insights.
 */
export async function synthesizeFeedback(
  feedbackEntries: Array<{
    rating: number
    feedbackText: string | null
    recommendation: string | null
    userId: string
  }>,
  interviewContext?: {
    candidateName?: string
    jobTitle?: string
    interviewType?: string
  }
): Promise<FeedbackSynthesis> {
  if (!feedbackEntries || feedbackEntries.length === 0) {
    logger.warn({ message: 'No feedback entries to synthesize' })
    throw new Error('At least one feedback entry is required for synthesis')
  }

  logger.info({
    message: 'Starting feedback synthesis',
    feedbackCount: feedbackEntries.length,
    candidateName: interviewContext?.candidateName,
    jobTitle: interviewContext?.jobTitle,
  })

  const contextSection = interviewContext
    ? `
=== INTERVIEW CONTEXT ===
Candidate: ${interviewContext.candidateName || 'Unknown'}
Job Title: ${interviewContext.jobTitle || 'Unknown'}
Interview Type: ${interviewContext.interviewType || 'Unknown'}
`
    : ''

  const feedbackSection = feedbackEntries
    .map(
      (entry, i) => `
--- Feedback ${i + 1} ---
Rating: ${entry.rating}/10
Recommendation: ${entry.recommendation || 'Not provided'}
Feedback: ${entry.feedbackText || 'No written feedback provided'}
`
    )
    .join('\n')

  const averageRating =
    feedbackEntries.reduce((sum, e) => sum + e.rating, 0) / feedbackEntries.length

  const prompt = `You are an HR analytics expert. Analyze the following interview feedback entries and synthesize them into comprehensive insights.

${contextSection}
=== FEEDBACK ENTRIES ===
${feedbackSection}

=== STATISTICS ===
Total Feedback Entries: ${feedbackEntries.length}
Average Rating: ${averageRating.toFixed(1)}/10
Recommendations: ${feedbackEntries.map((e) => e.recommendation).filter(Boolean).join(', ') || 'None provided'}

=== INSTRUCTIONS ===
Produce a JSON object with this exact structure:

{
  "overallSentiment": "<very_positive | positive | neutral | negative | very_negative>",
  "candidateSatisfactionScore": <number 0-100>,
  "interviewExperienceScore": <number 0-100>,
  "keyThemes": ["<recurring theme 1>", "<recurring theme 2>"],
  "improvementAreas": ["<area the company could improve 1>", "<area 2>"],
  "candidateHighlights": ["<what was appreciated 1>", "<what 2>"],
  "comparisonToAverage": {
    "score": <number -50 to +50, 0 = average>,
    "trend": "<improving | stable | declining>"
  },
  "actionableInsights": ["<specific suggestion 1>", "<suggestion 2>"]
}

GUIDELINES:
- candidateSatisfactionScore: Derive from ratings and written feedback sentiment. Scale 0-100 where 100 is perfect.
- interviewExperienceScore: Focus on the quality of the interview process itself.
- keyThemes: Identify 2-5 recurring themes across all feedback entries.
- improvementAreas: 1-3 actionable areas the interview process could improve.
- candidateHighlights: 1-3 positive aspects mentioned or implied.
- comparisonToAverage: Estimate how this interview compares to typical outcomes. Use 0 if uncertain.
- actionableInsights: 2-4 specific, implementable suggestions.
- If feedback is limited or vague, provide conservative estimates and note the data quality.
- Sentiment mapping: avg rating 8-10 = very_positive, 6-7.9 = positive, 5-5.9 = neutral, 3-4.9 = negative, 1-2.9 = very_negative`

  try {
    const synthesis = await generateJSON<FeedbackSynthesis>(prompt, 2048)

    // Validate and ensure required fields
    if (!synthesis.overallSentiment || typeof synthesis.candidateSatisfactionScore !== 'number') {
      logger.error({ message: 'Invalid feedback synthesis response structure' })
      throw new Error('Failed to parse feedback synthesis response')
    }

    // Ensure arrays exist
    synthesis.keyThemes = synthesis.keyThemes || []
    synthesis.improvementAreas = synthesis.improvementAreas || []
    synthesis.candidateHighlights = synthesis.candidateHighlights || []
    synthesis.actionableInsights = synthesis.actionableInsights || []

    // Ensure comparison object
    if (!synthesis.comparisonToAverage) {
      synthesis.comparisonToAverage = { score: 0, trend: 'stable' }
    }

    // Clamp scores to valid ranges
    synthesis.candidateSatisfactionScore = Math.max(
      0,
      Math.min(100, Math.round(synthesis.candidateSatisfactionScore))
    )
    synthesis.interviewExperienceScore = Math.max(
      0,
      Math.min(100, Math.round(synthesis.interviewExperienceScore))
    )
    synthesis.comparisonToAverage.score = Math.max(
      -50,
      Math.min(50, Math.round(synthesis.comparisonToAverage.score))
    )

    logger.info({
      message: 'Feedback synthesis complete',
      overallSentiment: synthesis.overallSentiment,
      satisfactionScore: synthesis.candidateSatisfactionScore,
      experienceScore: synthesis.interviewExperienceScore,
    })

    return synthesis
  } catch (error) {
    captureError(error, {
      component: 'feedback-synthesis',
      action: 'synthesizeFeedback',
      metadata: {
        feedbackCount: feedbackEntries.length,
        averageRating,
      },
    })
    throw error
  }
}
