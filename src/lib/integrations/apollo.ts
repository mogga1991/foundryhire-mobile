/**
 * Apollo.io Integration
 *
 * Strengths:
 * - B2B contact database (270M+ contacts)
 * - People & organization search
 * - Email enrichment
 * - Company intelligence
 *
 * Best Used For:
 * - Initial candidate discovery
 * - Email finding (B2B focus)
 * - Company/organization data
 */

import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'

const logger = createLogger('integration:apollo')
const APOLLO_API_KEY = env.APOLLO_API_KEY || ''
const APOLLO_BASE_URL = 'https://api.apollo.io/v1'

// =============================================================================
// Types
// =============================================================================

export interface ApolloPersonSearch {
  q_keywords?: string // Job titles, skills, etc.
  person_locations?: string[]
  person_titles?: string[]
  organization_num_employees_ranges?: string[]
  page?: number
  per_page?: number // Max 100
}

export interface ApolloPerson {
  id: string
  first_name: string
  last_name: string
  name: string
  title: string
  email: string | null
  phone_numbers: Array<{
    number: string
    type: 'mobile' | 'work' | 'other'
  }>
  organization: {
    name: string
    website_url: string
    industry: string
    employees: number
  } | null
  linkedin_url: string | null
  city: string
  state: string
  country: string
  employment_history: Array<{
    title: string
    company: string
    start_date: string
    end_date: string | null
    current: boolean
  }>
}

export interface ApolloEnrichmentInput {
  first_name?: string
  last_name?: string
  email?: string
  domain?: string
  linkedin_url?: string
}

// =============================================================================
// Search Functions
// =============================================================================

/**
 * Search for people using Apollo's database
 * Great for: Initial candidate discovery in construction industry
 */
export async function searchPeople(
  params: ApolloPersonSearch
): Promise<ApolloPerson[]> {
  try {
    const response = await fetch(`${APOLLO_BASE_URL}/mixed_people/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': APOLLO_API_KEY,
      },
      body: JSON.stringify({
        ...params,
        per_page: params.per_page || 25,
      }),
    })

    if (!response.ok) {
      throw new Error(`Apollo API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.people || []
  } catch (error) {
    logger.error({ message: 'Search error', error })
    return []
  }
}

/**
 * Search for construction professionals specifically
 */
export async function searchConstructionProfessionals(
  jobTitle: string,
  location: string,
  maxResults: number = 50
): Promise<ApolloPerson[]> {
  const pages = Math.ceil(maxResults / 25) // Apollo max 25 per page

  const allPeople: ApolloPerson[] = []

  for (let page = 1; page <= pages; page++) {
    const people = await searchPeople({
      q_keywords: `${jobTitle} construction`,
      person_locations: [location],
      person_titles: [jobTitle],
      page,
      per_page: 25,
    })

    allPeople.push(...people)

    if (people.length < 25) break // No more results
  }

  return allPeople.slice(0, maxResults)
}

// =============================================================================
// Enrichment Functions
// =============================================================================

/**
 * Enrich a single person with Apollo data
 * Great for: Finding missing emails, job titles, company info
 */
export async function enrichPerson(
  input: ApolloEnrichmentInput
): Promise<ApolloPerson | null> {
  try {
    const response = await fetch(`${APOLLO_BASE_URL}/people/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': APOLLO_API_KEY,
      },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Apollo API error: ${response.status}`)
    }

    const data = await response.json()
    return data.person || null
  } catch (error) {
    logger.error({ message: 'Enrichment error', error })
    return null
  }
}

/**
 * Bulk enrich people (up to 10 at once)
 */
export async function enrichPeopleBulk(
  inputs: ApolloEnrichmentInput[]
): Promise<Array<ApolloPerson | null>> {
  try {
    const response = await fetch(`${APOLLO_BASE_URL}/people/bulk_match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': APOLLO_API_KEY,
      },
      body: JSON.stringify({
        details: inputs.slice(0, 10), // Max 10
      }),
    })

    if (!response.ok) {
      throw new Error(`Apollo API error: ${response.status}`)
    }

    const data = await response.json()
    return data.people || []
  } catch (error) {
    logger.error({ message: 'Bulk enrichment error', error })
    return []
  }
}

// =============================================================================
// Organization Functions
// =============================================================================

/**
 * Enrich organization/company data
 */
export async function enrichOrganization(domain: string) {
  try {
    const response = await fetch(`${APOLLO_BASE_URL}/organizations/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': APOLLO_API_KEY,
      },
      body: JSON.stringify({ domain }),
    })

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Apollo API error: ${response.status}`)
    }

    const data = await response.json()
    return data.organization || null
  } catch (error) {
    logger.error({ message: 'Organization enrichment error', error })
    return null
  }
}

// =============================================================================
// Email Finding
// =============================================================================

/**
 * Find email using Apollo (great for B2B contacts)
 */
export async function findEmail(
  firstName: string,
  lastName: string,
  domain: string
): Promise<string | null> {
  const enriched = await enrichPerson({
    first_name: firstName,
    last_name: lastName,
    domain,
  })

  return enriched?.email || null
}
