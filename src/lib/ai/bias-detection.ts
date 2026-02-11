import { generateJSON } from '@/lib/ai/claude'
import { estimateTokens, truncateText } from '@/lib/ai/utils'
import { createLogger } from '@/lib/logger'
import { getCachedAnalysis, setCachedAnalysis } from '@/lib/ai/cache'

const logger = createLogger('bias-detection')

export interface BiasAnalysis {
  overallRiskLevel: 'low' | 'medium' | 'high'
  overallScore: number // 0-100, 100 = no bias detected
  categories: {
    genderBias: { score: number; flags: string[]; examples: string[] }
    racialBias: { score: number; flags: string[]; examples: string[] }
    ageBias: { score: number; flags: string[]; examples: string[] }
    disabilityBias: { score: number; flags: string[]; examples: string[] }
    socioeconomicBias: { score: number; flags: string[]; examples: string[] }
  }
  flaggedPhrases: Array<{
    phrase: string
    category: string
    severity: 'low' | 'medium' | 'high'
    suggestion: string // Alternative phrasing
  }>
  recommendations: string[]
}

/**
 * Build a prompt for Claude to analyze interview transcripts for bias
 */
export function buildBiasDetectionPrompt(
  transcript: string,
  interviewerQuestions?: string[]
): string {
  const questionsSection = interviewerQuestions?.length
    ? `\n=== INTERVIEWER QUESTIONS ===\n${interviewerQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`
    : ''

  return `You are an expert in employment law, diversity & inclusion, and unbiased hiring practices. Analyze the following interview transcript for potential bias indicators and compliance issues.

${questionsSection}
=== INTERVIEW TRANSCRIPT ===
${transcript}

=== ANALYSIS INSTRUCTIONS ===
Thoroughly analyze the transcript for bias across multiple dimensions. Consider:

**1. PROTECTED CHARACTERISTICS SCREENING**
Identify any questions or comments about:
- Age, birth year, graduation dates (used to infer age)
- Marital status, family planning, children, pregnancy
- Race, ethnicity, national origin, accent discrimination
- Religion, religious holidays, religious practices
- Disability, health conditions, medical history
- Gender identity, sexual orientation
- Socioeconomic background, financial status

**2. ILLEGAL INTERVIEW QUESTIONS**
Flag questions that violate employment law such as:
- "Are you married?" "Do you have children?" "Are you planning to have kids?"
- "What is your native language?" "Where were you born?"
- "How old are you?" "What year did you graduate?"
- "Do you have any disabilities?" "Have you ever filed a workers' compensation claim?"
- "What is your religion?" "Do you attend church?"
- "Are you pregnant?" "Do you plan to get pregnant?"

**3. BIAS INDICATORS**
Look for subtle bias patterns:
- Leading or loaded questions that reveal interviewer assumptions
- Tone differences or language changes when discussing certain topics
- Interruption patterns or unequal speaking time
- Inconsistent evaluation criteria or question depth
- Stereotyping language or generalizations
- Cultural bias in expected behaviors or norms
- Socioeconomic assumptions (e.g., requiring personal vehicle, unpaid travel)

**4. MICROAGGRESSIONS & SUBTLE BIAS**
Identify statements like:
- "You're so articulate" (can imply racial bias)
- Comments on appearance unrelated to job
- Assumptions about technical ability based on demographics
- "Culture fit" used to exclude diverse candidates
- Name pronunciation issues or comments
- Accent or language proficiency comments (unless job-relevant)

**5. POSITIVE EQUITY PRACTICES**
Note any good practices such as:
- Structured, consistent questions across candidates
- Job-relevant evaluation criteria
- Focus on skills and experience
- Inclusive language

Provide your analysis as a JSON object with this exact structure:

{
  "overallRiskLevel": "<low, medium, or high>",
  "overallScore": <number 0-100, where 100 = no bias detected, 0 = severe bias>,
  "categories": {
    "genderBias": {
      "score": <0-100>,
      "flags": ["<specific issue 1>", "<specific issue 2>"],
      "examples": ["<quote from transcript>", "<quote from transcript>"]
    },
    "racialBias": {
      "score": <0-100>,
      "flags": ["<specific issue 1>", "<specific issue 2>"],
      "examples": ["<quote from transcript>"]
    },
    "ageBias": {
      "score": <0-100>,
      "flags": ["<specific issue 1>"],
      "examples": ["<quote from transcript>"]
    },
    "disabilityBias": {
      "score": <0-100>,
      "flags": ["<specific issue 1>"],
      "examples": ["<quote from transcript>"]
    },
    "socioeconomicBias": {
      "score": <0-100>,
      "flags": ["<specific issue 1>"],
      "examples": ["<quote from transcript>"]
    }
  },
  "flaggedPhrases": [
    {
      "phrase": "<exact problematic phrase from transcript>",
      "category": "<genderBias, racialBias, ageBias, disabilityBias, or socioeconomicBias>",
      "severity": "<low, medium, or high>",
      "suggestion": "<alternative phrasing or recommended action>"
    }
  ],
  "recommendations": [
    "<actionable recommendation 1 for improving interview fairness>",
    "<actionable recommendation 2>",
    "<actionable recommendation 3>"
  ]
}

**SCORING GUIDELINES:**
- Category scores: 100 = no bias detected, 80-99 = minor concerns, 60-79 = moderate concerns, 0-59 = significant bias
- Overall score: Average of category scores, weighted by severity
- Risk level: high if overall < 60, medium if 60-79, low if >= 80
- If no bias detected in a category, score should be 100 with empty flags/examples arrays
- Be specific: cite exact quotes, don't make vague accusations
- Consider context: some questions may be legal/appropriate depending on job requirements (e.g., "Can you lift 50 lbs?" for construction roles)
- Flag borderline cases as "low" severity with explanatory suggestions`
}

/**
 * Analyze an interview transcript for potential bias
 */
export async function analyzeBias(
  transcript: string,
  interviewerQuestions?: string[]
): Promise<BiasAnalysis> {
  // Validate input
  if (!transcript || transcript.trim().length < 50) {
    logger.warn({ message: 'Transcript too short for bias analysis' })
    throw new Error('Transcript must be at least 50 characters for bias analysis')
  }

  // Check cache first
  const cacheContext = { interviewerQuestions }
  const cached = getCachedAnalysis<BiasAnalysis>(transcript, cacheContext)
  if (cached) {
    logger.info('Returning cached bias analysis')
    return cached
  }

  // Estimate tokens and truncate if needed
  const maxTokens = 6000
  const estimatedTokens = estimateTokens(transcript)

  let processedTranscript = transcript
  if (estimatedTokens > maxTokens) {
    logger.info({ message: `Transcript too long (${estimatedTokens} tokens), truncating to ${maxTokens} tokens` })
    // Approximate character count for target tokens (4 chars per token)
    const maxChars = maxTokens * 4
    processedTranscript = truncateText(transcript, maxChars)
  }

  // Build prompt and call Claude
  const prompt = buildBiasDetectionPrompt(processedTranscript, interviewerQuestions)

  logger.info('Running bias detection analysis')
  const analysis = await generateJSON<BiasAnalysis>(prompt, 4000)

  // Validate response structure
  if (!analysis.overallRiskLevel || !analysis.categories) {
    logger.error({ message: 'Invalid bias analysis response structure' })
    throw new Error('Failed to parse bias analysis response')
  }

  logger.info({
    message: 'Bias analysis complete',
    overallRiskLevel: analysis.overallRiskLevel,
    overallScore: analysis.overallScore
  })

  // Cache the result
  setCachedAnalysis(processedTranscript, cacheContext, analysis)

  return analysis
}
