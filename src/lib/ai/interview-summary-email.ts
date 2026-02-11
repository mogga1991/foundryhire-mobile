/**
 * Interview Summary Email Generation
 *
 * Generates professional email summaries for hiring managers and candidates
 * after interview analysis is complete.
 */

import { generateCompletion } from '@/lib/ai/claude'
import { createLogger } from '@/lib/logger'
import type { EnhancedInterviewAnalysis } from '@/lib/ai/prompts/interview-analysis'

const logger = createLogger('interview-summary-email')

export interface InterviewEmailData {
  candidateName: string
  candidateEmail?: string
  position: string
  interviewDate: Date
  interviewId: string
  aiSummary: string
  sentimentScore: number
  competencyScores: {
    technical: number
    communication: number
    problemSolving: number
    leadership: number
    domainExpertise: number
    cultureFit: number
    adaptability: number
  }
  strengths: string[]
  concerns: string[]
  recommendation: string
  recommendationConfidence: number
  biasDetected?: boolean
  biasDetails?: string
  keyMoments?: Array<{
    quote: string
    significance: string
    sentiment: 'positive' | 'neutral' | 'negative'
  }>
  interviewDetailUrl?: string
}

export type RecipientType = 'hiring_manager' | 'candidate'

/**
 * Generate a professional interview summary email
 */
export async function generateInterviewSummaryEmail(
  interviewData: InterviewEmailData,
  recipientType: RecipientType
): Promise<string> {
  logger.info({
    message: 'Generating interview summary email',
    interviewId: interviewData.interviewId,
    recipientType,
  })

  if (recipientType === 'hiring_manager') {
    return generateHiringManagerEmail(interviewData)
  } else {
    return generateCandidateEmail(interviewData)
  }
}

/**
 * Generate email for hiring manager with detailed analysis
 */
async function generateHiringManagerEmail(data: InterviewEmailData): Promise<string> {
  const prompt = `You are an expert at crafting professional, actionable hiring summary emails for technical recruiting managers.

Generate an HTML email body for a hiring manager summarizing an interview analysis. The email should be:
- Professional and concise (not verbose)
- Action-oriented with clear next steps
- Data-driven with specific evidence
- Visually organized with clear sections

=== INTERVIEW DATA ===
Candidate: ${data.candidateName}
Position: ${data.position}
Interview Date: ${data.interviewDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

AI Summary: ${data.aiSummary}

Recommendation: ${formatRecommendation(data.recommendation)}
Confidence: ${data.recommendationConfidence}%

Competency Scores (0-100):
- Technical: ${data.competencyScores.technical}
- Communication: ${data.competencyScores.communication}
- Problem Solving: ${data.competencyScores.problemSolving}
- Leadership: ${data.competencyScores.leadership}
- Domain Expertise: ${data.competencyScores.domainExpertise}
- Culture Fit: ${data.competencyScores.cultureFit}
- Adaptability: ${data.competencyScores.adaptability}

Strengths:
${data.strengths.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Concerns:
${data.concerns.length > 0 ? data.concerns.map((c, i) => `${i + 1}. ${c}`).join('\n') : 'None identified'}

${data.biasDetected ? `\n⚠️ Bias Detection Alert: ${data.biasDetails}\n` : ''}

${data.keyMoments ? `\nKey Moments:
${data.keyMoments.slice(0, 3).map(m => `- ${m.quote} (${m.sentiment})\n  ${m.significance}`).join('\n\n')}` : ''}

${data.interviewDetailUrl ? `\nFull Interview Detail: ${data.interviewDetailUrl}` : ''}

=== EMAIL REQUIREMENTS ===
1. Start with a clear subject line recommendation (separate line starting with "Subject:")
2. Use professional HTML formatting with inline CSS
3. Include sections:
   - Opening with candidate name and position
   - **Overall Recommendation** (hire/maybe/no_hire with confidence)
   - **Top 3 Strengths** (bullet points)
   - **Top 3 Concerns** (bullet points, or "No significant concerns" if none)
   - **Competency Overview** (simple text-based visualization or table)
   - **Bias Check Results** (if applicable)
   - **Next Steps** (clear call to action)
   - Link to full interview details (if URL provided)
4. Use a color scheme: orange (#f97316) for primary actions, slate for text
5. Keep the tone professional but conversational
6. Make the recommendation visually prominent
7. Include a simple visual representation of scores (e.g., text-based bars or table)

DO NOT include boilerplate like "Dear [Name]" - start directly with content.
Return ONLY the HTML email body. No markdown code blocks, no explanations.`

  const htmlBody = await generateCompletion(prompt, 2000)

  // Clean up any markdown artifacts
  return htmlBody.replace(/```html?\n?/g, '').replace(/```\n?/g, '').trim()
}

/**
 * Generate email for candidate with encouraging, general feedback
 */
async function generateCandidateEmail(data: InterviewEmailData): Promise<string> {
  const prompt = `You are an expert at crafting warm, professional, and encouraging candidate communication.

Generate an HTML email body for a candidate after their interview. The email should:
- Thank them warmly for their time
- Provide general, constructive feedback (NO specific scores)
- Be encouraging regardless of outcome
- Focus on positive aspects of the conversation
- Mention next steps in a professional, non-committal way
- Be personable and respectful

=== INTERVIEW DATA ===
Candidate: ${data.candidateName}
Position: ${data.position}
Interview Date: ${data.interviewDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

Overall Impression: ${data.aiSummary}
General Sentiment: ${data.sentimentScore >= 70 ? 'Very positive' : data.sentimentScore >= 50 ? 'Positive' : 'Neutral'}

Strengths (use these to provide encouraging feedback without revealing scores):
${data.strengths.map((s, i) => `${i + 1}. ${s}`).join('\n')}

=== EMAIL REQUIREMENTS ===
CRITICAL RULES:
- NEVER reveal numerical scores or ratings
- NEVER mention "bias detection" or internal analysis
- NEVER use phrases like "strong_hire" or "no_hire"
- Focus on QUALITATIVE feedback only
- Be encouraging and constructive

Email Structure:
1. Subject line recommendation (separate line starting with "Subject:")
2. Warm opening thanking them for their time
3. Brief positive feedback highlighting 2-3 areas where they did well (based on strengths, but generalized)
4. Mention next steps in a professional way: "Our team is currently reviewing all candidates and will be in touch soon with next steps."
5. Encouraging closing
6. Use professional HTML formatting with inline CSS
7. Color scheme: orange (#f97316) for branding, warm and friendly tone

DO NOT include specific scores, detailed analysis, or internal terminology.
DO NOT be overly effusive or make promises about hiring.
KEEP the tone warm, professional, and respectful.

Return ONLY the HTML email body. No markdown code blocks, no explanations.`

  const htmlBody = await generateCompletion(prompt, 1500)

  // Clean up any markdown artifacts
  return htmlBody.replace(/```html?\n?/g, '').replace(/```\n?/g, '').trim()
}

/**
 * Format recommendation for display
 */
function formatRecommendation(recommendation: string): string {
  switch (recommendation) {
    case 'strong_hire':
      return 'Strong Hire ⭐⭐⭐'
    case 'hire':
      return 'Hire ⭐⭐'
    case 'maybe':
      return 'Maybe / Further Evaluation Needed ⭐'
    case 'no_hire':
      return 'No Hire'
    case 'strong_no_hire':
      return 'Strong No Hire'
    default:
      return recommendation
  }
}
