export interface JobDescriptionParams {
  title: string
  requirements: string[]
  location: string
  salaryRange?: {
    min: number
    max: number
    currency?: string
  }
  employmentType?: string
  industrySector?: string
}

export function buildJobDescriptionPrompt(params: JobDescriptionParams): string {
  const {
    title,
    requirements,
    location,
    salaryRange,
    employmentType = 'Full-time',
    industrySector = 'Construction',
  } = params

  const requirementsList = requirements.map((r) => `- ${r}`).join('\n')

  const salarySection = salaryRange
    ? `Salary Range: ${salaryRange.currency ?? 'USD'} ${salaryRange.min.toLocaleString()} - ${salaryRange.max.toLocaleString()} per year`
    : 'Salary: Competitive, commensurate with experience'

  return `You are an expert construction industry recruiter and technical writer. Generate a professional, compelling job description for the following position.

Position Details:
- Job Title: ${title}
- Industry Sector: ${industrySector}
- Location: ${location}
- Employment Type: ${employmentType}
- ${salarySection}

Required Qualifications and Skills:
${requirementsList}

Instructions:
1. Write a professional job description that would attract top talent in the construction industry.
2. Structure the output with the following clearly labeled sections:
   - **About the Role**: A compelling 2-3 paragraph overview of the position, its importance to the organization, and what makes this opportunity exciting. Reference the specific construction sector and location.
   - **Key Responsibilities**: 6-8 bullet points describing the primary duties. Be specific to the construction industry context (e.g., site management, safety compliance, project delivery, stakeholder coordination).
   - **Required Qualifications**: Expand on the provided requirements with construction-industry-specific context. Include relevant certifications (OSHA, PMP, LEED, etc.) where appropriate for the role level.
   - **Preferred Qualifications**: 4-6 additional nice-to-have qualifications that would make a candidate stand out, relevant to the construction sector.
   - **What We Offer**: 5-6 bullet points covering compensation, benefits, and growth opportunities typical for construction industry roles.

3. Use professional but approachable language.
4. Include construction-specific terminology appropriate for the role (e.g., BIM, RFIs, submittals, change orders, CPM scheduling, means and methods).
5. Emphasize safety culture and commitment to quality where relevant.
6. Mention relevant compliance frameworks (OSHA, EPA, local building codes) appropriate for the role.
7. Do NOT use generic filler language. Every sentence should add value.
8. Keep the total length between 500-700 words.

CRITICAL FORMATTING REQUIREMENTS:
- Use ONLY bold text (** **) for section titles
- DO NOT use markdown headers (##, ###, etc.)
- Section titles should be on their own line with a blank line after them
- Use bullet points (-) for lists
- Keep formatting clean and professional

Example format:
**Section Title**

Content here...

- Bullet point 1
- Bullet point 2`
}
