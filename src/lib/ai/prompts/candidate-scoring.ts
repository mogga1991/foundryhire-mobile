export interface JobDetails {
  title: string
  required_skills: string[]
  nice_to_have_skills: string[]
  experience_years_min: number
  location: string
  industry_sector: string
}

export interface CandidateProfile {
  name: string
  currentTitle: string
  currentCompany: string
  yearsExperience: number
  skills: string[]
  location: string
}

export interface CandidateScoringResult {
  score: number
  reasoning: string
  strengths: string[]
  concerns: string[]
  recommendation: 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no'
}

export function buildCandidateScoringPrompt(
  job: JobDetails,
  candidate: CandidateProfile
): string {
  const requiredSkillsList = job.required_skills.map((s) => `- ${s}`).join('\n')
  const niceToHaveSkillsList = job.nice_to_have_skills.map((s) => `- ${s}`).join('\n')
  const candidateSkillsList = candidate.skills.map((s) => `- ${s}`).join('\n')

  return `You are an expert construction industry recruiter with deep knowledge of talent evaluation. Analyze the fit between the following job and candidate, then provide a detailed scoring assessment.

=== JOB DETAILS ===
Title: ${job.title}
Industry Sector: ${job.industry_sector}
Location: ${job.location}
Minimum Experience Required: ${job.experience_years_min} years

Required Skills:
${requiredSkillsList}

Nice-to-Have Skills:
${niceToHaveSkillsList}

=== CANDIDATE PROFILE ===
Name: ${candidate.name}
Current Title: ${candidate.currentTitle}
Current Company: ${candidate.currentCompany}
Years of Experience: ${candidate.yearsExperience}
Location: ${candidate.location}

Candidate Skills:
${candidateSkillsList}

=== SCORING INSTRUCTIONS ===
Evaluate this candidate against the job requirements and provide a comprehensive assessment. Consider the following factors:

1. **Skills Match** (40% weight): How well do the candidate's skills align with the required and nice-to-have skills? Consider both exact matches and transferable/related skills within the construction industry.

2. **Experience Level** (25% weight): Does the candidate meet or exceed the minimum experience requirement? Consider the relevance and quality of experience based on their current title and company.

3. **Role Alignment** (20% weight): How well does the candidate's current role and career trajectory align with the target position? Consider progression within the construction industry.

4. **Location Fit** (15% weight): Is the candidate in or near the job location? Consider willingness to relocate common in the construction industry.

Provide your response as a JSON object with the following structure:
{
  "score": <number between 0 and 100>,
  "reasoning": "<2-3 sentence overall assessment explaining the score>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "concerns": ["<concern 1>", "<concern 2>"],
  "recommendation": "<one of: strong_yes, yes, maybe, no, strong_no>"
}

Scoring Guidelines:
- 90-100: Exceptional match, candidate exceeds requirements in most areas
- 75-89: Strong match, candidate meets most requirements with minor gaps
- 60-74: Moderate match, candidate meets core requirements but has notable gaps
- 40-59: Weak match, candidate has some relevant experience but significant gaps
- 0-39: Poor match, candidate lacks most required qualifications

Be specific in strengths and concerns. Reference actual skills, experience levels, and role relevance rather than making generic statements.`
}
