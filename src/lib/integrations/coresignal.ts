/**
 * Coresignal Integration
 *
 * Strengths:
 * - Comprehensive employment history data
 * - Multi-source aggregation
 * - Clean, verified data
 * - Rich professional experience details
 *
 * Best Used For:
 * - Getting detailed employment history
 * - Verifying candidate experience
 * - Finding career progression patterns
 */

const CORESIGNAL_API_KEY = process.env.CORESIGNAL_API_KEY || ''
const CORESIGNAL_BASE_URL = 'https://api.coresignal.com/cdapi/v1'

// =============================================================================
// Types
// =============================================================================

export interface CoresignalSearchParams {
  title?: string
  location?: string
  company?: string
  industry?: string
  skills?: string[]
  experience_years_min?: number
  experience_years_max?: number
  limit?: number
}

export interface CoresignalEmployee {
  id: string
  name: string
  title: string
  location: string
  industry: string
  experience: Array<{
    title: string
    company: string
    company_id: string
    location: string
    start_date: string
    end_date: string | null
    duration_months: number
    description: string
    is_current: boolean
  }>
  education: Array<{
    institution: string
    degree: string
    field_of_study: string
    start_date: string
    end_date: string
  }>
  skills: string[]
  certifications: Array<{
    name: string
    issuing_organization: string
    issue_date: string
    expiration_date: string | null
  }>
  linkedin_url: string
  total_experience_months: number
}

// =============================================================================
// Multi-Source Employee API (Most Comprehensive)
// =============================================================================

/**
 * Search employees using Multi-Source API
 * This combines data from multiple sources for the richest profiles
 */
export async function searchEmployeesMultiSource(
  params: CoresignalSearchParams
): Promise<CoresignalEmployee[]> {
  try {
    const response = await fetch(
      `${CORESIGNAL_BASE_URL}/professional_network/member/search/filter`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CORESIGNAL_API_KEY}`,
        },
        body: JSON.stringify({
          title: params.title,
          location: params.location,
          company: params.company,
          industry: params.industry,
          limit: params.limit || 100,
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Coresignal API error: ${response.status}`)
    }

    const data = await response.json()
    return data.items || []
  } catch (error) {
    console.error('[Coresignal] Multi-Source search error:', error)
    return []
  }
}

/**
 * Get employee by ID (Multi-Source)
 */
export async function getEmployeeMultiSource(
  employeeId: string
): Promise<CoresignalEmployee | null> {
  try {
    const response = await fetch(
      `${CORESIGNAL_BASE_URL}/professional_network/member/collect/${employeeId}`,
      {
        headers: {
          Authorization: `Bearer ${CORESIGNAL_API_KEY}`,
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Coresignal API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('[Coresignal] Get employee error:', error)
    return null
  }
}

// =============================================================================
// Clean Employee API (Verified Data)
// =============================================================================

/**
 * Search employees using Clean API
 * This provides deduplicated, verified data
 */
export async function searchEmployeesClean(
  params: CoresignalSearchParams
): Promise<CoresignalEmployee[]> {
  try {
    const response = await fetch(
      `${CORESIGNAL_BASE_URL}/professional_network/member/search_clean/filter`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CORESIGNAL_API_KEY}`,
        },
        body: JSON.stringify({
          title: params.title,
          location: params.location,
          company: params.company,
          limit: params.limit || 100,
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Coresignal Clean API error: ${response.status}`)
    }

    const data = await response.json()
    return data.items || []
  } catch (error) {
    console.error('[Coresignal] Clean search error:', error)
    return []
  }
}

// =============================================================================
// Base Employee API (Foundation Data)
// =============================================================================

/**
 * Search employees using Base API
 * This provides foundational employee information
 */
export async function searchEmployeesBase(
  params: CoresignalSearchParams
): Promise<CoresignalEmployee[]> {
  try {
    const response = await fetch(
      `${CORESIGNAL_BASE_URL}/professional_network/member/search/filter`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CORESIGNAL_API_KEY}`,
        },
        body: JSON.stringify({
          title: params.title,
          location: params.location,
          company: params.company,
          limit: params.limit || 100,
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Coresignal Base API error: ${response.status}`)
    }

    const data = await response.json()
    return data.items || []
  } catch (error) {
    console.error('[Coresignal] Base search error:', error)
    return []
  }
}

// =============================================================================
// Construction-Specific Searches
// =============================================================================

/**
 * Find construction professionals with detailed experience
 */
export async function searchConstructionProfessionals(
  jobTitle: string,
  location: string,
  experienceYears?: number
): Promise<CoresignalEmployee[]> {
  return await searchEmployeesMultiSource({
    title: jobTitle,
    location,
    industry: 'Construction',
    experience_years_min: experienceYears,
    limit: 100,
  })
}

/**
 * Get verified employment history for a candidate
 */
export async function getVerifiedEmploymentHistory(
  candidateName: string,
  currentCompany?: string
): Promise<CoresignalEmployee | null> {
  const results = await searchEmployeesClean({
    title: candidateName,
    company: currentCompany,
    limit: 1,
  })

  return results[0] || null
}

// =============================================================================
// Data Enrichment Helpers
// =============================================================================

/**
 * Calculate total experience in construction
 */
export function calculateConstructionExperience(
  employee: CoresignalEmployee
): number {
  const constructionExperience = employee.experience.filter((exp) =>
    exp.company.toLowerCase().includes('construction') ||
    exp.title.toLowerCase().includes('construction') ||
    exp.description?.toLowerCase().includes('construction')
  )

  return constructionExperience.reduce((total, exp) => total + exp.duration_months, 0) / 12
}

/**
 * Extract construction-specific skills
 */
export function extractConstructionSkills(employee: CoresignalEmployee): string[] {
  const constructionSkills = [
    'Procore',
    'AutoCAD',
    'Revit',
    'BIM',
    'Project Management',
    'OSHA',
    'Safety Management',
    'Scheduling',
    'Estimating',
    'Bluebeam',
    'Primavera',
    'P6',
    'Lean Construction',
    'LEED',
  ]

  return employee.skills.filter((skill) =>
    constructionSkills.some((cs) => skill.toLowerCase().includes(cs.toLowerCase()))
  )
}

/**
 * Get current position
 */
export function getCurrentPosition(
  employee: CoresignalEmployee
): CoresignalEmployee['experience'][0] | null {
  const current = employee.experience.find((exp) => exp.is_current)
  return current || employee.experience[0] || null
}
