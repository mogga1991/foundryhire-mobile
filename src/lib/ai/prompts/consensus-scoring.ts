export interface InterviewerFeedback {
  interviewerId: string
  interviewerName: string
  role: string // 'interviewer' | 'hiring_manager' | 'recruiter' | 'observer'
  rating: number // 1-10
  recommendation: string // 'strong_hire' | 'hire' | 'maybe' | 'no_hire'
  feedbackText: string
  competencyRatings?: Record<string, number> // optional per-competency ratings
  confidenceLevel?: number // 1-5 how confident they are
}

export interface JobContext {
  title?: string
  requirements?: string[]
  skills?: string[]
}

export function buildConsensusPrompt(
  feedbackEntries: InterviewerFeedback[],
  aiAnalysis?: string,
  jobContext?: JobContext
): string {
  const contextSection = jobContext
    ? `
=== JOB CONTEXT ===
${jobContext.title ? `Position: ${jobContext.title}` : ''}
${jobContext.requirements?.length ? `Requirements:\n${jobContext.requirements.map((r) => `- ${r}`).join('\n')}` : ''}
${jobContext.skills?.length ? `Required Skills:\n${jobContext.skills.map((s) => `- ${s}`).join('\n')}` : ''}
`
    : ''

  const aiSection = aiAnalysis
    ? `
=== AI ANALYSIS (Reference) ===
${aiAnalysis}
`
    : ''

  const feedbackSection = feedbackEntries
    .map(
      (feedback, idx) => `
=== INTERVIEWER ${idx + 1}: ${feedback.interviewerName} (${feedback.role}) ===
Rating: ${feedback.rating}/10
Recommendation: ${feedback.recommendation}
Confidence Level: ${feedback.confidenceLevel || 'Not specified'}/5
${feedback.competencyRatings ? `Competency Ratings: ${JSON.stringify(feedback.competencyRatings)}` : ''}

Feedback:
${feedback.feedbackText}
`
    )
    .join('\n')

  return `You are an expert interview panel facilitator and hiring decision advisor. Your role is to synthesize multiple interviewer perspectives into a fair, balanced, and actionable consensus recommendation.

${contextSection}${aiSection}
=== INTERVIEWER FEEDBACK (${feedbackEntries.length} Interviewers) ===
${feedbackSection}

=== CONSENSUS ANALYSIS INSTRUCTIONS ===

Your task is to analyze all interviewer feedback and create a unified, evidence-based consensus recommendation. Follow these principles:

**1. ANTI-BIAS FRAMEWORK**
- Do NOT automatically favor higher-ranking interviewers (e.g., hiring managers over recruiters)
- Do NOT dismiss outlier opinions without understanding their reasoning
- DO weigh evidence quality: specific examples > vague impressions
- DO consider role-appropriate expertise: technical interviewers on tech skills, hiring managers on leadership fit
- DO flag when disagreement stems from different evaluation criteria rather than candidate performance

**2. DISAGREEMENT IDENTIFICATION**
Analyze patterns of disagreement:
- Rating spread: Flag if max rating - min rating > 3 points
- Recommendation misalignment: Note when some say "hire" while others say "no_hire"
- Competency disagreements: Identify specific areas where interviewers disagree
- For EACH disagreement, determine:
  - Is this a legitimate difference in observation? (e.g., one interviewer tested skills the other didn't)
  - Is this a bias or calibration issue? (e.g., one interviewer has unrealistic standards)
  - Can it be resolved? If so, how?

**3. COMMON THEMES EXTRACTION**
- Strengths: What do multiple interviewers consistently praise?
- Concerns: What red flags appear in multiple feedback entries?
- Unique Insights: What valuable observations came from only one interviewer?

**4. EVIDENCE-BASED SYNTHESIS**
- Prioritize specific examples over generalities
- Quote interviewer feedback when relevant
- Acknowledge when evidence is thin or contradictory
- Don't invent details not present in the feedback

**5. CALIBRATED RECOMMENDATION**
Generate a hiring recommendation that:
- Reflects the preponderance of evidence
- Accounts for the severity of any concerns
- Considers the job requirements (if provided)
- Provides clear rationale for the decision
- Acknowledges uncertainty when present

**6. CONFIDENCE SCORING**
- High confidence (80-100): Strong agreement, clear evidence
- Medium confidence (50-79): Some disagreement, but resolvable
- Low confidence (0-49): Significant disagreement, insufficient evidence, or conflicting signals

**7. CALIBRATION NOTES**
If you notice systematic issues in the interview process, note them:
- Interviewer bias patterns
- Inconsistent evaluation criteria
- Gaps in interview coverage
- Suggestions for improving panel alignment

**RESPONSE FORMAT**
Provide your analysis as a JSON object with this exact structure:

{
  "interviewId": "<will be set by the system>",
  "generatedAt": "<ISO timestamp - will be set by system>",
  "overallScore": <weighted average 0-100>,
  "consensusRecommendation": "<strong_hire|hire|maybe|no_hire>",
  "confidence": <0-100>,

  "hasSignificantDisagreement": <boolean>,
  "disagreementAreas": [
    {
      "area": "<e.g., 'Technical skills assessment'>",
      "interviewerPositions": [
        {
          "name": "<interviewer name>",
          "position": "<summary of their view>"
        }
      ],
      "resolution": "<how to interpret or resolve this disagreement>"
    }
  ],

  "commonStrengths": [
    "<strength mentioned by multiple interviewers>"
  ],
  "commonConcerns": [
    "<concern mentioned by multiple interviewers>"
  ],
  "uniqueInsights": [
    {
      "interviewer": "<name>",
      "insight": "<valuable observation from this interviewer>"
    }
  ],

  "interviewerSummaries": [
    {
      "name": "<interviewer name>",
      "role": "<their role>",
      "rating": <their rating>,
      "recommendation": "<their recommendation>",
      "weight": <calculated weight based on role>,
      "keyPoints": [
        "<key observation 1>",
        "<key observation 2>"
      ]
    }
  ],

  "narrativeSummary": "<2-3 paragraph synthesis explaining: What do we know about this candidate? What are the areas of agreement? What are the areas of disagreement? What's the overall picture?>",

  "hiringDecisionRationale": "<Clear explanation of why the consensusRecommendation was chosen, weighing the evidence, addressing disagreements, and connecting to job requirements if available>",

  "calibrationNotes": "<Optional: observations about interviewer alignment, bias patterns, or process improvements. Omit if no issues detected.>"
}

**SCORING GUIDELINES:**
- Calculate weighted average based on interviewer roles:
  - Hiring manager: 1.5x weight
  - Interviewer: 1.0x weight
  - Recruiter: 0.8x weight
  - Observer: 0.5x weight
- Convert 1-10 ratings to 0-100 scale: (rating - 1) * 11.11
- Apply weights and average
- Adjust confidence based on disagreement level

**IMPORTANT:**
- Be intellectually honest: don't paper over real disagreements
- Acknowledge limitations: if evidence is weak, say so
- Focus on helping make the right hiring decision, not pleasing everyone
- Consider false positive vs false negative risks in your recommendation`
}
