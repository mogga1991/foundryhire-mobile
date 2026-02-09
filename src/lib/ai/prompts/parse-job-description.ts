export interface ParseJobDescriptionResult {
  title?: string
  location?: string
  department?: string
  employmentType?: 'full-time' | 'part-time' | 'contract' | 'temporary' | 'internship'
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'lead' | 'executive'
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
  skillsRequired?: string[]
  skillsPreferred?: string[]
  description?: string
  requirements?: string[]
  responsibilities?: string[]
  benefits?: string[]
  confidence: {
    overall: number
    fields: Record<string, number>
  }
  missingFields: string[]
}

export function buildParseJobDescriptionPrompt(text: string): string {
  return `You are an expert at parsing job descriptions and extracting structured data. Your task is to analyze the following job description text and extract all relevant information into a structured JSON format.

JOB DESCRIPTION TEXT:
${text}

INSTRUCTIONS:
1. Extract the following fields if they are present in the text:
   - title: The job title/position name
   - location: The job location (city, state, country, or "Remote")
   - department: The department or industry sector (e.g., "Construction", "Engineering", "Sales")
   - employmentType: One of: "full-time", "part-time", "contract", "temporary", or "internship"
   - experienceLevel: One of: "entry", "mid", "senior", "lead", or "executive"
   - salaryMin: Minimum salary as a number (extract from ranges like "$80,000 - $100,000" or "80k-100k")
   - salaryMax: Maximum salary as a number
   - salaryCurrency: Currency code (default to "USD" if mentioned in dollars)
   - skillsRequired: Array of required skills, qualifications, or certifications
   - skillsPreferred: Array of preferred/nice-to-have skills
   - description: The full job description text or summary paragraph
   - requirements: Array of specific job requirements or qualifications
   - responsibilities: Array of key responsibilities or duties
   - benefits: Array of benefits, perks, or offerings

2. Normalize the data:
   - Convert salary abbreviations: "80k" → 80000, "120K" → 120000
   - Normalize experience levels: "Sr." → "senior", "Junior" → "entry", "Lead/Principal" → "lead"
   - Normalize employment types: "FT" → "full-time", "PT" → "part-time"
   - Extract skills from lists, paragraphs, or bullet points
   - Separate required vs preferred skills when explicitly mentioned

3. Provide confidence scores:
   - overall: Your overall confidence (0-100) in the accuracy of the parsed data
   - fields: Per-field confidence scores as an object { fieldName: score }
   - Only include confidence scores for fields that were extracted

4. List missing fields:
   - Include an array of field names that are critical but couldn't be determined from the text
   - Critical fields: title, location, skillsRequired, description
   - Don't list optional fields like benefits or preferredSkills as missing

5. Handle edge cases:
   - If no salary is mentioned, omit salaryMin, salaryMax, salaryCurrency
   - If skills aren't clearly separated into required vs preferred, put all in skillsRequired
   - If responsibilities and requirements overlap, use your best judgment to separate them
   - Extract skills from context (e.g., "5 years of Python" → include "Python" in skills)

6. Return valid JSON only (no markdown, no explanations):
{
  "title": string | undefined,
  "location": string | undefined,
  "department": string | undefined,
  "employmentType": string | undefined,
  "experienceLevel": string | undefined,
  "salaryMin": number | undefined,
  "salaryMax": number | undefined,
  "salaryCurrency": string | undefined,
  "skillsRequired": string[] | undefined,
  "skillsPreferred": string[] | undefined,
  "description": string | undefined,
  "requirements": string[] | undefined,
  "responsibilities": string[] | undefined,
  "benefits": string[] | undefined,
  "confidence": {
    "overall": number,
    "fields": {
      "title": number,
      "location": number,
      ...
    }
  },
  "missingFields": string[]
}

EXAMPLE OUTPUT:
{
  "title": "Senior Construction Project Manager",
  "location": "Denver, CO",
  "department": "Construction",
  "employmentType": "full-time",
  "experienceLevel": "senior",
  "salaryMin": 120000,
  "salaryMax": 150000,
  "salaryCurrency": "USD",
  "skillsRequired": ["OSHA Safety Certification", "Project Management", "Budget Control", "AutoCAD", "Team Leadership"],
  "skillsPreferred": ["LEED Certification", "Advanced Excel", "Bilingual Spanish"],
  "description": "We are seeking an experienced Senior Construction Project Manager to lead large-scale commercial construction projects...",
  "requirements": ["10+ years in construction management", "Bachelor's degree in Construction Management or related field", "OSHA 30-hour certification"],
  "responsibilities": ["Manage project timelines and budgets", "Coordinate with subcontractors and vendors", "Ensure safety compliance", "Lead team of 15-20 workers"],
  "benefits": ["Competitive salary", "401(k) matching", "Health insurance", "Paid time off", "Professional development"],
  "confidence": {
    "overall": 90,
    "fields": {
      "title": 95,
      "location": 100,
      "salaryMin": 85,
      "salaryMax": 85,
      "skillsRequired": 80
    }
  },
  "missingFields": []
}

Now parse the job description text above and return ONLY the JSON output (no explanations, no markdown code blocks).`
}
