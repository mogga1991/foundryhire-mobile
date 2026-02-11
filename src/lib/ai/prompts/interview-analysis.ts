export interface InterviewContext {
  candidateName?: string
  jobTitle?: string
  jobRequirements?: string[]
  jobSkills?: string[]
  candidateResume?: string
}

export interface EnhancedInterviewAnalysis {
  summary: string
  sentimentScore: number
  competencyScores: {
    technical: { score: number; evidence: string[] }
    communication: { score: number; evidence: string[] }
    problemSolving: { score: number; evidence: string[] }
    leadership: { score: number; evidence: string[] }
    domainExpertise: { score: number; evidence: string[] }
    cultureFit: { score: number; evidence: string[] }
    adaptability: { score: number; evidence: string[] }
  }
  strengths: string[]
  concerns: string[]
  recommendation: 'strong_hire' | 'hire' | 'maybe' | 'no_hire' | 'strong_no_hire'
  recommendationConfidence: number
  interviewQuality: {
    questionCoverage: number
    candidateEngagement: number
    interviewerEffectiveness: number
  }
  suggestedFollowUp: string[]
  keyMoments: Array<{
    timestamp?: string
    quote: string
    significance: string
    sentiment: 'positive' | 'neutral' | 'negative'
  }>
}

export function buildEnhancedInterviewAnalysisPrompt(
  transcript: string,
  context?: InterviewContext
): string {
  const contextSection = context
    ? `
=== INTERVIEW CONTEXT ===
${context.candidateName ? `Candidate: ${context.candidateName}` : ''}
${context.jobTitle ? `Position: ${context.jobTitle}` : ''}
${context.jobRequirements?.length ? `Key Requirements:\n${context.jobRequirements.map((r) => `- ${r}`).join('\n')}` : ''}
${context.jobSkills?.length ? `Required Skills:\n${context.jobSkills.map((s) => `- ${s}`).join('\n')}` : ''}
${context.candidateResume ? `\nCandidate Resume Summary:\n${context.candidateResume}` : ''}
`
    : ''

  return `You are an expert interview analyst specializing in comprehensive talent evaluation for the construction and skilled trades industry. Analyze the following interview transcript with a focus on evidence-based assessment.

${contextSection}
=== INTERVIEW TRANSCRIPT ===
${transcript}

=== ANALYSIS INSTRUCTIONS ===
Provide a detailed, evidence-based analysis of the interview. Every score and observation must be supported by specific quotes or examples from the transcript.

**1. EXECUTIVE SUMMARY**
Provide a concise 2-3 sentence summary capturing:
- Overall impression of the candidate
- Key standout qualities or concerns
- Fit for the role (if context provided)

**2. SENTIMENT ANALYSIS**
Score 0-100 representing the overall tone and positivity of the interview:
- 90-100: Highly positive, enthusiastic, confident
- 70-89: Generally positive with good rapport
- 50-69: Neutral or mixed signals
- 30-49: Some negative indicators or disengagement
- 0-29: Predominantly negative tone

**3. COMPETENCY SCORING (Evidence-Based)**
Score each competency 0-100 and provide 2-4 specific evidence quotes:

- **Technical**: Job-specific technical knowledge, tools, methodologies, industry standards
- **Communication**: Clarity, articulation, active listening, ability to explain complex concepts
- **Problem Solving**: Analytical thinking, approach to challenges, troubleshooting ability
- **Leadership**: Team management, decision-making, mentoring, taking initiative
- **Domain Expertise**: Industry knowledge, project types, regulations, best practices
- **Culture Fit**: Values alignment, team collaboration, work style, company mission resonance
- **Adaptability**: Flexibility, learning agility, handling change, diverse situations

For each competency, provide:
{
  "score": <0-100>,
  "evidence": [
    "<direct quote or specific example from transcript>",
    "<direct quote or specific example from transcript>",
    "<direct quote or specific example from transcript>"
  ]
}

**4. STRENGTHS & CONCERNS**
- Strengths: 3-5 specific strengths demonstrated in the interview (with implicit reference to evidence)
- Concerns: Any red flags, gaps, or areas of uncertainty (be specific, not vague)

**5. HIRING RECOMMENDATION**
- Recommendation: Choose one of: strong_hire, hire, maybe, no_hire, strong_no_hire
  - strong_hire: Exceptional candidate, exceeds requirements, immediate hire
  - hire: Strong candidate, meets/exceeds most requirements
  - maybe: Mixed signals, meets some requirements, needs further evaluation
  - no_hire: Does not meet key requirements or has significant concerns
  - strong_no_hire: Poor fit, fundamental gaps, or serious red flags

- Confidence: 0-100 score indicating confidence in the recommendation
  - 90-100: Very confident, clear decision
  - 70-89: Confident with minor uncertainties
  - 50-69: Moderate confidence, some ambiguity
  - 0-49: Low confidence, insufficient information

**6. INTERVIEW QUALITY METRICS**
Assess the interview process itself (0-100 for each):
- Question Coverage: How well did the interview cover relevant competencies and job requirements?
- Candidate Engagement: How engaged, responsive, and participative was the candidate?
- Interviewer Effectiveness: How structured, unbiased, and thorough was the interviewer?

**7. SUGGESTED FOLLOW-UP**
Provide 2-4 specific follow-up questions or next steps:
- Address any gaps in the current interview
- Probe deeper on areas of concern
- Validate key strengths or claims
- Assess competencies not fully covered

**8. KEY MOMENTS**
Identify 3-5 significant moments from the interview:
- Breakthrough insights or impressive responses
- Red flags or concerning statements
- Turning points in the conversation
- Notable demonstrations of competency

For each key moment:
{
  "timestamp": "<time in interview if available, or 'early', 'mid', 'late'>",
  "quote": "<exact quote from transcript>",
  "significance": "<why this moment matters for the evaluation>",
  "sentiment": "<positive, neutral, or negative>"
}

**RESPONSE FORMAT**
Provide your analysis as a JSON object with this exact structure:

{
  "summary": "<executive summary>",
  "sentimentScore": <0-100>,
  "competencyScores": {
    "technical": { "score": <0-100>, "evidence": ["quote 1", "quote 2", ...] },
    "communication": { "score": <0-100>, "evidence": ["quote 1", "quote 2", ...] },
    "problemSolving": { "score": <0-100>, "evidence": ["quote 1", "quote 2", ...] },
    "leadership": { "score": <0-100>, "evidence": ["quote 1", "quote 2", ...] },
    "domainExpertise": { "score": <0-100>, "evidence": ["quote 1", "quote 2", ...] },
    "cultureFit": { "score": <0-100>, "evidence": ["quote 1", "quote 2", ...] },
    "adaptability": { "score": <0-100>, "evidence": ["quote 1", "quote 2", ...] }
  },
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "concerns": ["concern 1", "concern 2"],
  "recommendation": "<strong_hire|hire|maybe|no_hire|strong_no_hire>",
  "recommendationConfidence": <0-100>,
  "interviewQuality": {
    "questionCoverage": <0-100>,
    "candidateEngagement": <0-100>,
    "interviewerEffectiveness": <0-100>
  },
  "suggestedFollowUp": ["question 1", "question 2", "question 3"],
  "keyMoments": [
    {
      "timestamp": "<timestamp or position>",
      "quote": "<exact quote>",
      "significance": "<explanation>",
      "sentiment": "<positive|neutral|negative>"
    }
  ]
}

**IMPORTANT GUIDELINES:**
- Be objective and fair, avoiding bias
- Root all claims in evidence from the transcript
- If information is insufficient for a competency, score conservatively (50-60) and note the gap
- Consider context: construction/trades industry norms, safety culture, hands-on experience
- Balance positive and negative observations
- Make actionable recommendations`
}
