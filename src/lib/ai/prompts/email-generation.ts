export interface EmailJobDetails {
  title: string
  location: string
  salaryRange?: {
    min: number
    max: number
    currency?: string
  }
}

export interface EmailCandidateProfile {
  name: string
  currentRole: string
  currentCompany: string
  yearsExperience: number
}

export interface GeneratedEmail {
  subject: string
  body: string
}

export function buildEmailGenerationPrompt(
  job: EmailJobDetails,
  candidate: EmailCandidateProfile,
  companyName: string
): string {
  const salarySection = job.salaryRange
    ? `Salary Range: ${job.salaryRange.currency ?? 'USD'} ${job.salaryRange.min.toLocaleString()} - ${job.salaryRange.max.toLocaleString()} per year`
    : 'Salary: Competitive'

  return `You are an expert construction industry recruiter writing a personalized outreach email to a potential candidate. The email should feel genuine, not templated.

=== JOB DETAILS ===
Company: ${companyName}
Position: ${job.title}
Location: ${job.location}
${salarySection}

=== CANDIDATE DETAILS ===
Name: ${candidate.name}
Current Role: ${candidate.currentRole}
Current Company: ${candidate.currentCompany}
Years of Experience: ${candidate.yearsExperience}

=== EMAIL REQUIREMENTS ===
Write a personalized recruiting outreach email following these guidelines:

1. **Tone**: Professional but warm and conversational. Avoid corporate jargon and overly formal language. Write as if you are a real recruiter who has reviewed their background.

2. **Personalization**: Reference the candidate's current role, company, and experience level naturally. Show that you have done your research and are not sending a mass email.

3. **Value Proposition**: Clearly communicate why this opportunity might interest them. Focus on career growth, project scope, company culture, or compensation where relevant.

4. **Call to Action**: End with a clear, low-pressure next step (e.g., a brief call or coffee meeting). Make it easy for them to say yes.

5. **Length**: Keep the entire email body under 150 words. Brevity is critical for recruiter outreach emails.

6. **Subject Line**: Write a compelling subject line that would stand out in a busy inbox. Avoid clickbait. Keep it under 60 characters.

Provide your response as a JSON object with the following structure:
{
  "subject": "<Email subject line>",
  "body": "<Complete email body including greeting and sign-off. Use the recruiter name 'The ${companyName} Talent Team' for the sign-off. Use plain text with line breaks (\\n) for formatting.>"
}

Important:
- Do NOT include salary figures in the email unless the candidate would be taking a significant step up.
- Do NOT use phrases like "exciting opportunity" or "I came across your profile" - these are overused in recruiting.
- DO reference specifics about the construction industry that would resonate with someone at their career level.
- The first sentence should hook the reader immediately.`
}
