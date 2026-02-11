export interface CandidateForComparison {
  candidateId: string
  candidateName: string
  interviewId: string
  competencyScores: Record<string, { score: number; evidence: string[] }>
  overallScore: number
  sentimentScore: number
  summary: string
  recommendationConfidence: number
  keyStrengths?: string[]
  keyWeaknesses?: string[]
}

export interface JobContext {
  title?: string
  description?: string
  requirements?: string[]
  skillsRequired?: string[]
  experienceLevel?: string
}

/**
 * Build a prompt for Claude to compare and rank multiple candidates
 */
export function buildCandidateComparisonPrompt(
  candidates: CandidateForComparison[],
  jobContext?: JobContext
): string {
  const jobSection = jobContext
    ? `
=== JOB CONTEXT ===
${jobContext.title ? `Position: ${jobContext.title}` : ''}
${jobContext.experienceLevel ? `Experience Level: ${jobContext.experienceLevel}` : ''}
${jobContext.requirements?.length ? `\nKey Requirements:\n${jobContext.requirements.map((r) => `- ${r}`).join('\n')}` : ''}
${jobContext.skillsRequired?.length ? `\nRequired Skills:\n${jobContext.skillsRequired.map((s) => `- ${s}`).join('\n')}` : ''}
${jobContext.description ? `\nJob Description:\n${jobContext.description}` : ''}
`
    : ''

  const candidatesSection = candidates
    .map((candidate, index) => {
      const competencies = Object.keys(candidate.competencyScores)
      const competencyDetails = competencies
        .map(
          (comp) =>
            `  - ${comp}: ${candidate.competencyScores[comp].score}/100 (${candidate.competencyScores[comp].evidence.length} evidence items)`
        )
        .join('\n')

      return `
=== CANDIDATE ${index + 1}: ${candidate.candidateName} ===
Interview ID: ${candidate.interviewId}
Overall Score: ${candidate.overallScore}/100
Sentiment Score: ${candidate.sentimentScore}/100
Recommendation Confidence: ${candidate.recommendationConfidence}%

Summary:
${candidate.summary}

Competency Scores:
${competencyDetails}

${candidate.keyStrengths?.length ? `Key Strengths:\n${candidate.keyStrengths.map((s) => `- ${s}`).join('\n')}` : ''}
${candidate.keyWeaknesses?.length ? `\nKey Weaknesses:\n${candidate.keyWeaknesses.map((w) => `- ${w}`).join('\n')}` : ''}
`
    })
    .join('\n')

  return `You are an expert talent acquisition analyst specializing in evidence-based candidate evaluation and comparison for the construction and skilled trades industry. Compare the following candidates who interviewed for the same position and provide a ranked recommendation.

${jobSection}
=== CANDIDATES TO COMPARE ===
${candidatesSection}

=== COMPARISON INSTRUCTIONS ===

**CRITICAL: BIAS MITIGATION REQUIREMENTS**
You MUST focus ONLY on demonstrated competencies and evidence from the interviews. You MUST NOT:
- Consider or infer any demographic information (age, gender, race, ethnicity, national origin, etc.)
- Make assumptions based on names, language patterns, or cultural references
- Use "culture fit" as a way to prefer similar backgrounds
- Factor in any information not directly related to job performance

**1. COMPARATIVE ANALYSIS**
For each candidate, analyze their performance across all competencies:
- Compare scores within each competency dimension
- Identify relative strengths and weaknesses
- Consider the quality and quantity of evidence supporting each score
- Weight competencies based on job requirements (if provided)

**2. RANKING METHODOLOGY**
Rank candidates based on:
- Overall competency scores weighted by job requirements
- Quality and depth of demonstrated skills
- Recommendation confidence levels
- Fit for the specific role requirements
- Areas of exceptional strength vs. critical gaps

**3. RELATIVE STRENGTH ASSESSMENT**
For each competency, classify each candidate's relative performance:
- **strongest**: Top performer in this competency among the group
- **above_average**: Better than most but not the top
- **average**: Middle of the group
- **below_average**: Weaker than most in the group
- **weakest**: Lowest performer in this competency among the group

**4. OVERALL FIT SCORE**
Calculate an overall fit score (0-100) for each candidate that considers:
- Job requirements alignment (if provided)
- Competency balance (well-rounded vs. specialized)
- Critical skill requirements
- Growth potential and adaptability

**5. COMPARATIVE INSIGHTS**
Identify cross-candidate observations:
- Which competencies show the most variation across candidates
- Common strengths or gaps across the candidate pool
- Unique capabilities or risk factors
- Trade-offs between different candidates

**6. HIRING RECOMMENDATION**
Provide a clear, actionable recommendation that:
- Explains the ranking rationale
- Highlights key differentiators
- Notes any trade-offs or considerations
- Suggests next steps (e.g., second interviews, skill assessments)

**7. DIVERSITY & INCLUSION REMINDER**
Include a reminder for hiring managers to:
- Review the analysis for any unconscious bias
- Consider diverse perspectives and experiences as strengths
- Ensure interview process was fair and consistent
- Make final decisions based on job-relevant factors only

**RESPONSE FORMAT**
Provide your analysis as a JSON object with this exact structure:

{
  "generatedAt": "<ISO 8601 timestamp>",
  "rankings": [
    {
      "rank": <1, 2, 3, etc.>,
      "candidateId": "<candidate ID>",
      "candidateName": "<candidate name>",
      "overallFitScore": <0-100>,
      "competencyComparison": {
        "<competency_name>": {
          "score": <0-100>,
          "relativeStrength": "<strongest|above_average|average|below_average|weakest>"
        }
      },
      "strengths": [
        "<specific strength 1>",
        "<specific strength 2>",
        "<specific strength 3>"
      ],
      "concerns": [
        "<specific concern or gap 1>",
        "<specific concern or gap 2>"
      ],
      "recommendation": "<1-2 sentence hiring recommendation for this candidate>"
    }
  ],
  "comparativeInsights": [
    "<cross-candidate observation 1>",
    "<cross-candidate observation 2>",
    "<cross-candidate observation 3>"
  ],
  "hiringRecommendation": "<2-3 sentence overall recommendation explaining the ranking and next steps>",
  "diversityConsiderations": "<reminder to hiring managers about avoiding bias and considering diverse perspectives>"
}

**IMPORTANT GUIDELINES:**
- Base all comparisons on objective, demonstrated competencies from interview evidence
- Be specific about why one candidate ranks higher than another
- Acknowledge trade-offs (e.g., Candidate A has stronger technical skills but Candidate B shows better leadership)
- Consider job requirements when weighting competencies
- Ensure recommendations are fair, evidence-based, and job-relevant
- Use inclusive language throughout the analysis
- Remember that different backgrounds and experiences can be valuable assets
- If candidates are very close in ranking, acknowledge this and suggest additional evaluation methods`
}
