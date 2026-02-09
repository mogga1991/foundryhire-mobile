/**
 * Proxycurl Integration
 *
 * Strengths:
 * - LinkedIn profile enrichment
 * - Employee search by company
 * - Contact discovery (email/phone)
 * - Company employee lists
 *
 * Best Used For:
 * - LinkedIn profile data extraction
 * - Finding employees at specific companies
 * - Contact information lookup
 */

const PROXYCURL_API_KEY = process.env.PROXYCURL_API_KEY || ''
const PROXYCURL_BASE_URL = 'https://nubela.co/proxycurl/api/v2'

// =============================================================================
// Types
// =============================================================================

export interface ProxycurlPersonProfile {
  public_identifier: string
  first_name: string
  last_name: string
  full_name: string
  occupation: string
  headline: string
  summary: string
  country: string
  city: string
  state: string
  experiences: Array<{
    starts_at: { day: number; month: number; year: number }
    ends_at: { day: number; month: number; year: number } | null
    company: string
    company_linkedin_profile_url: string
    title: string
    description: string
    location: string
    logo_url: string
  }>
  education: Array<{
    starts_at: { day: number; month: number; year: number }
    ends_at: { day: number; month: number; year: number } | null
    field_of_study: string
    degree_name: string
    school: string
    school_linkedin_profile_url: string
  }>
  skills: string[]
  certifications: Array<{
    name: string
    authority: string
    starts_at: { day: number; month: number; year: number }
    ends_at: { day: number; month: number; year: number } | null
  }>
  emails: string[]
  phone_numbers: string[]
}

export interface EmployeeSearchParams {
  company_url: string // LinkedIn company URL
  job_title?: string
  location?: string
  page_size?: number // Max 100
  enrich_profiles?: boolean
}

// =============================================================================
// Profile Enrichment
// =============================================================================

/**
 * Get LinkedIn profile data
 * Cost: 1 credit per request
 */
export async function getLinkedInProfile(
  linkedinUrl: string,
  includeContactInfo: boolean = true
): Promise<ProxycurlPersonProfile | null> {
  if (!PROXYCURL_API_KEY) {
    console.warn('[Proxycurl] API key not configured')
    return null
  }

  try {
    const params = new URLSearchParams({
      url: linkedinUrl,
      use_cache: 'if-present',
      fallback_to_cache: 'on-error',
      skills: 'include',
      extra: includeContactInfo ? 'include' : 'exclude',
    })

    const response = await fetch(
      `${PROXYCURL_BASE_URL}/linkedin?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${PROXYCURL_API_KEY}`,
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Proxycurl API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('[Proxycurl] Profile enrichment error:', error)
    return null
  }
}

// =============================================================================
// Employee Search
// =============================================================================

/**
 * Search for employees at a company
 * Great for: Finding all Project Managers at Turner Construction
 */
export async function searchCompanyEmployees(
  params: EmployeeSearchParams
): Promise<ProxycurlPersonProfile[]> {
  if (!PROXYCURL_API_KEY) {
    console.warn('[Proxycurl] API key not configured')
    return []
  }

  try {
    const searchParams = new URLSearchParams({
      linkedin_company_profile_url: params.company_url,
      page_size: (params.page_size || 10).toString(),
      enrich_profiles: params.enrich_profiles ? 'enrich' : 'skip',
    })

    if (params.job_title) {
      searchParams.append('job_title', params.job_title)
    }

    if (params.location) {
      searchParams.append('location', params.location)
    }

    const response = await fetch(
      `${PROXYCURL_BASE_URL}/search/company?${searchParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${PROXYCURL_API_KEY}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Proxycurl API error: ${response.status}`)
    }

    const data = await response.json()
    return data.employees || []
  } catch (error) {
    console.error('[Proxycurl] Employee search error:', error)
    return []
  }
}

/**
 * Find construction employees at major firms
 */
export async function findConstructionEmployees(
  companyName: string,
  jobTitle: string,
  location?: string
): Promise<ProxycurlPersonProfile[]> {
  // Map company name to LinkedIn URL
  const companyUrl = await resolveCompanyLinkedInUrl(companyName)
  if (!companyUrl) return []

  return await searchCompanyEmployees({
    company_url: companyUrl,
    job_title: jobTitle,
    location,
    page_size: 50,
    enrich_profiles: true,
  })
}

// =============================================================================
// Contact Discovery
// =============================================================================

/**
 * Find email from LinkedIn profile
 * Cost: 1 credit per request
 */
export async function findEmailFromLinkedIn(
  linkedinUrl: string
): Promise<string | null> {
  const profile = await getLinkedInProfile(linkedinUrl, true)
  return profile?.emails?.[0] || null
}

/**
 * Find phone from LinkedIn profile
 * Cost: 1 credit per request
 */
export async function findPhoneFromLinkedIn(
  linkedinUrl: string
): Promise<string | null> {
  const profile = await getLinkedInProfile(linkedinUrl, true)
  return profile?.phone_numbers?.[0] || null
}

/**
 * Reverse lookup: Find LinkedIn profile from email
 * Cost: 1 credit per request
 */
export async function findLinkedInFromEmail(
  email: string
): Promise<string | null> {
  if (!PROXYCURL_API_KEY) return null

  try {
    const params = new URLSearchParams({ email })

    const response = await fetch(
      `${PROXYCURL_BASE_URL}/linkedin/profile/resolve/email?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${PROXYCURL_API_KEY}`,
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Proxycurl API error: ${response.status}`)
    }

    const data = await response.json()
    return data.url || null
  } catch (error) {
    console.error('[Proxycurl] Reverse email lookup error:', error)
    return null
  }
}

// =============================================================================
// Company Helpers
// =============================================================================

/**
 * Resolve company name to LinkedIn URL
 */
async function resolveCompanyLinkedInUrl(companyName: string): Promise<string | null> {
  if (!PROXYCURL_API_KEY) return null

  try {
    const params = new URLSearchParams({
      company_name: companyName,
      enrich_profile: 'skip',
    })

    const response = await fetch(
      `${PROXYCURL_BASE_URL}/linkedin/company/resolve?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${PROXYCURL_API_KEY}`,
        },
      }
    )

    if (!response.ok) return null

    const data = await response.json()
    return data.url || null
  } catch (error) {
    console.error('[Proxycurl] Company resolve error:', error)
    return null
  }
}

/**
 * Get employee count at a company
 */
export async function getCompanyEmployeeCount(
  companyUrl: string
): Promise<number | null> {
  if (!PROXYCURL_API_KEY) return null

  try {
    const params = new URLSearchParams({
      url: companyUrl,
    })

    const response = await fetch(
      `${PROXYCURL_BASE_URL}/linkedin/company/employees/count?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${PROXYCURL_API_KEY}`,
        },
      }
    )

    if (!response.ok) return null

    const data = await response.json()
    return data.employee_count || null
  } catch (error) {
    console.error('[Proxycurl] Employee count error:', error)
    return null
  }
}
