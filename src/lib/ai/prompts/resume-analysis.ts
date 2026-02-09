export interface ResumeJobDetails {
  title: string
  required_skills: string[]
  experience_years_min: number
  industry_sector: string
  location?: string
}

export interface ResumeAnalysisResult {
  summary: string
  years_experience: number
  skills: string[]
  experience: {
    title: string
    company: string
    duration: string
    description: string
  }[]
  education: {
    degree: string
    institution: string
    year: string
  }[]
  certifications: string[]
  green_flags: string[]
  red_flags: string[]
  recommendation: 'strong_fit' | 'good_fit' | 'potential_fit' | 'weak_fit' | 'not_a_fit'
}

export function buildResumeAnalysisPrompt(
  resumeText: string,
  job: ResumeJobDetails
): string {
  const requiredSkillsList = job.required_skills.map((s) => `- ${s}`).join('\n')

  return `You are an expert construction industry recruiter and resume analyst. Analyze the following resume in the context of the specified job opening and extract structured information.

=== TARGET JOB ===
Title: ${job.title}
Industry Sector: ${job.industry_sector}
Minimum Experience Required: ${job.experience_years_min} years
${job.location ? `Location: ${job.location}` : ''}

Required Skills:
${requiredSkillsList}

=== RESUME TEXT ===
${resumeText}

=== ANALYSIS INSTRUCTIONS ===
Carefully read the entire resume and extract the following information. Be thorough and accurate. If information is not explicitly stated, make reasonable inferences based on the content but note them as inferred.

Provide your response as a JSON object with the following structure:

{
  "summary": "<A concise 2-3 sentence professional summary of the candidate based on their resume. Highlight their most relevant experience and strongest qualifications for the target role.>",

  "years_experience": <Total years of professional experience as a number. Calculate from work history dates. If dates are ambiguous, provide your best estimate.>,

  "skills": ["<skill 1>", "<skill 2>", "..."],

  "experience": [
    {
      "title": "<Job title>",
      "company": "<Company name>",
      "duration": "<Start date - End date or Present>",
      "description": "<1-2 sentence summary of key responsibilities and achievements in this role>"
    }
  ],

  "education": [
    {
      "degree": "<Degree name and major>",
      "institution": "<School/University name>",
      "year": "<Graduation year or expected graduation>"
    }
  ],

  "certifications": ["<List all professional certifications, licenses, and credentials found. Include OSHA, PMP, PE, LEED, CCM, CPC, and any other industry certifications.>"],

  "green_flags": ["<Positive indicators that make this candidate strong for the target role. Be specific - reference actual experience, projects, certifications, or achievements from the resume. Include things like: relevant project types, safety record, leadership experience, technology proficiency, industry-specific expertise.>"],

  "red_flags": ["<Concerns or potential issues for the target role. Be specific - reference gaps in experience, missing required skills, job-hopping patterns, lack of relevant certifications, career trajectory concerns. If the resume has formatting issues or missing information, note that as well.>"],

  "recommendation": "<One of: strong_fit, good_fit, potential_fit, weak_fit, not_a_fit>"
}

Important Guidelines:
- Extract ALL skills mentioned in the resume, including technical skills, software proficiency, soft skills, and industry-specific competencies.
- For the construction industry, pay special attention to: safety certifications, project types (commercial, residential, industrial, infrastructure), software (Procore, PlanGrid, Bluebeam, AutoCAD, BIM tools), and regulatory knowledge.
- List experience entries in reverse chronological order (most recent first).
- Green flags should directly relate to the target job requirements.
- Red flags should be objective observations, not assumptions about the candidate's character.
- The recommendation should reflect how well the candidate's overall profile matches the target role requirements.`
}
