import { generateJSON } from '@/lib/ai/claude'
import { createLogger } from '@/lib/logger'
import type { EnhancedInterviewAnalysis } from '@/lib/ai/prompts/interview-analysis'

const logger = createLogger('follow-up-questions')

export interface FollowUpQuestion {
  question: string
  targetCompetency: string
  difficulty: 'standard' | 'probing' | 'deep-dive'
  rationale: string
  expectedSignals: {
    positive: string[]
    negative: string[]
  }
  timeAllocation: number
}

export interface FollowUpPlan {
  interviewId?: string
  generatedAt: string
  totalEstimatedMinutes: number
  priorityAreas: string[]
  questions: FollowUpQuestion[]
  interviewerGuidance: string
}

export interface JobContext {
  title?: string
  description?: string
  requirements?: string[]
  seniorityLevel?: string
}

/**
 * Build a prompt for Claude to generate targeted follow-up interview questions
 */
export function buildFollowUpQuestionsPrompt(
  analysisResult: EnhancedInterviewAnalysis,
  jobContext?: JobContext
): string {
  const jobSection = jobContext
    ? `
=== JOB CONTEXT ===
${jobContext.title ? `Position: ${jobContext.title}` : ''}
${jobContext.seniorityLevel ? `Seniority Level: ${jobContext.seniorityLevel}` : ''}
${jobContext.requirements?.length ? `Key Requirements:\n${jobContext.requirements.map((r) => `- ${r}`).join('\n')}` : ''}
${jobContext.description ? `\nJob Description:\n${jobContext.description}` : ''}
`
    : ''

  // Extract competencies with low scores or thin evidence
  const competencies = ['technical', 'communication', 'problemSolving', 'leadership', 'domainExpertise', 'cultureFit', 'adaptability'] as const
  const weakAreas: string[] = []
  const thinEvidence: string[] = []

  for (const competency of competencies) {
    const competencyData = analysisResult.competencyScores[competency]
    if (competencyData.score < 60) {
      weakAreas.push(`${competency} (score: ${competencyData.score})`)
    }
    if (competencyData.evidence.length < 2) {
      thinEvidence.push(`${competency} (only ${competencyData.evidence.length} evidence item${competencyData.evidence.length === 1 ? '' : 's'})`)
    }
  }

  const weakAreasSection = weakAreas.length > 0
    ? `\n**Weak Competencies (Score < 60):**\n${weakAreas.map((a) => `- ${a}`).join('\n')}`
    : ''

  const thinEvidenceSection = thinEvidence.length > 0
    ? `\n**Thin Evidence (< 2 examples):**\n${thinEvidence.map((a) => `- ${a}`).join('\n')}`
    : ''

  const concernsSection = analysisResult.concerns.length > 0
    ? `\n**Concerns Identified:**\n${analysisResult.concerns.map((c) => `- ${c}`).join('\n')}`
    : ''

  return `You are an expert interview strategist specializing in second-round follow-up interviews. Based on the initial interview analysis, generate targeted follow-up questions for a 30-minute second interview to address gaps and validate findings.

${jobSection}
=== INITIAL INTERVIEW ANALYSIS SUMMARY ===
Overall Recommendation: ${analysisResult.recommendation}
Confidence: ${analysisResult.recommendationConfidence}%
Sentiment Score: ${analysisResult.sentimentScore}/100

Competency Scores:
${competencies.map((c) => `- ${c}: ${analysisResult.competencyScores[c].score}/100 (${analysisResult.competencyScores[c].evidence.length} evidence items)`).join('\n')}

Interview Quality:
- Question Coverage: ${analysisResult.interviewQuality.questionCoverage}/100
- Candidate Engagement: ${analysisResult.interviewQuality.candidateEngagement}/100
- Interviewer Effectiveness: ${analysisResult.interviewQuality.interviewerEffectiveness}/100

Key Strengths:
${analysisResult.strengths.map((s) => `- ${s}`).join('\n')}
${concernsSection}${weakAreasSection}${thinEvidenceSection}

Suggested Follow-Up from Initial Analysis:
${analysisResult.suggestedFollowUp.map((f) => `- ${f}`).join('\n')}

=== FOLLOW-UP QUESTION GENERATION INSTRUCTIONS ===

**1. IDENTIFY PRIORITY AREAS**
Analyze the initial interview results and identify the 2-4 highest priority areas to explore in the follow-up interview:
- Competencies with scores < 60 (significant gaps)
- Competencies with thin evidence (< 2 examples), even if score is moderate
- Unexplored areas based on low question coverage
- Concerns that need validation or deeper exploration
- Strengths that need verification to increase confidence

**2. GENERATE TARGETED QUESTIONS**
Create 5-10 follow-up questions that:
- Address the priority areas identified above
- Use behavioral/situational STAR method format (Situation, Task, Action, Result)
- Vary in difficulty to probe at different depths
- Build on insights from the initial interview (reference concerns or gaps)
- Fit within a 30-minute session (total time across all questions)

**3. QUESTION DESIGN GUIDELINES**
- **Standard** questions: Straightforward behavioral questions to gather missing baseline information (2-3 min each)
- **Probing** questions: Dig deeper into areas of concern or validate claims from first interview (3-4 min each)
- **Deep-dive** questions: Complex scenarios or case-based questions for critical competencies (5 min each)

**4. EXPECTED SIGNALS**
For each question, define:
- **Positive signals**: What to listen for in a strong answer (specific behaviors, metrics, outcomes)
- **Negative signals**: Red flags or weak responses to watch for (vague answers, deflection, lack of ownership)

**5. INTERVIEWER GUIDANCE**
Provide overall guidance for conducting this follow-up interview:
- How to frame the conversation (building on first interview vs. addressing gaps)
- Key areas to emphasize
- Recommended approach (conversational vs. structured)
- How to use this time most effectively

**RESPONSE FORMAT**
Provide your analysis as a JSON object with this exact structure:

{
  "generatedAt": "<ISO 8601 timestamp>",
  "totalEstimatedMinutes": <sum of all timeAllocation values, should be ~25-30>,
  "priorityAreas": [
    "<competency or area 1>",
    "<competency or area 2>",
    "<competency or area 3>"
  ],
  "questions": [
    {
      "question": "<behavioral/situational question using STAR format>",
      "targetCompetency": "<technical|communication|problemSolving|leadership|domainExpertise|cultureFit|adaptability>",
      "difficulty": "<standard|probing|deep-dive>",
      "rationale": "<why this question is needed - reference specific gap from analysis>",
      "expectedSignals": {
        "positive": [
          "<specific positive indicator 1>",
          "<specific positive indicator 2>",
          "<specific positive indicator 3>"
        ],
        "negative": [
          "<red flag or weak response indicator 1>",
          "<red flag or weak response indicator 2>"
        ]
      },
      "timeAllocation": <suggested minutes: 2-5>
    }
  ],
  "interviewerGuidance": "<2-3 sentence overall guidance for conducting this follow-up interview>"
}

**IMPORTANT GUIDELINES:**
- Prioritize the weakest areas but also validate key strengths if confidence is low
- Questions should be specific and actionable, not generic
- Reference the candidate's industry context (construction/skilled trades if applicable)
- Ensure total time allocation is realistic for a 30-minute session (allow for intro/wrap-up)
- Use inclusive language and avoid bias in question phrasing
- Focus on demonstrated competencies and behaviors, not hypotheticals
- Include at least one question for each priority area identified`
}

/**
 * Generate targeted follow-up questions for a second-round interview
 * based on the initial interview analysis
 */
export async function generateFollowUpQuestions(
  analysisResult: EnhancedInterviewAnalysis,
  jobContext?: JobContext
): Promise<FollowUpPlan> {
  // Validate input
  if (!analysisResult || !analysisResult.competencyScores) {
    logger.warn({ message: 'Invalid analysis result provided' })
    throw new Error('Valid analysis result is required to generate follow-up questions')
  }

  // Build prompt
  const prompt = buildFollowUpQuestionsPrompt(analysisResult, jobContext)

  logger.info({
    message: 'Generating follow-up questions',
    recommendation: analysisResult.recommendation,
    confidence: analysisResult.recommendationConfidence,
  })

  // Call Claude to generate follow-up plan
  const followUpPlan = await generateJSON<FollowUpPlan>(prompt, 4000)

  // Validate response structure
  if (!followUpPlan.questions || !Array.isArray(followUpPlan.questions)) {
    logger.error({ message: 'Invalid follow-up plan response structure' })
    throw new Error('Failed to generate valid follow-up questions')
  }

  if (followUpPlan.questions.length < 3) {
    logger.warn({
      message: 'Fewer than 3 follow-up questions generated',
      questionCount: followUpPlan.questions.length
    })
  }

  // Validate each question has required fields
  for (const question of followUpPlan.questions) {
    if (!question.question || !question.targetCompetency || !question.rationale) {
      logger.error({ message: 'Invalid question structure', question })
      throw new Error('Generated question missing required fields')
    }
  }

  logger.info({
    message: 'Follow-up questions generated successfully',
    questionCount: followUpPlan.questions.length,
    totalMinutes: followUpPlan.totalEstimatedMinutes,
    priorityAreas: followUpPlan.priorityAreas
  })

  return followUpPlan
}
