/**
 * Lusha Integration
 *
 * Strengths:
 * - Fast contact enrichment (25 req/sec)
 * - Accurate email + phone finding
 * - Company data enrichment
 * - Real-time signals (job changes)
 *
 * Best Used For:
 * - Finding contact information quickly
 * - Bulk email/phone enrichment
 * - Tracking job changes
 */

const LUSHA_API_KEY = process.env.LUSHA_API_KEY || ''
const LUSHA_BASE_URL = 'https://api.lusha.com'

// =============================================================================
// Types
// =============================================================================

export interface LushaPersonInput {
  firstName?: string
  lastName?: string
  company?: string
  linkedinUrl?: string
  email?: string
}

export interface LushaPerson {
  firstName: string
  lastName: string
  title: string
  company: {
    name: string
    domain: string
    industry: string
    employees: number
  }
  emailAddresses: Array<{
    email: string
    type: 'personal' | 'work'
    status: 'valid' | 'invalid' | 'accept_all'
  }>
  phoneNumbers: Array<{
    number: string
    type: 'mobile' | 'work' | 'home'
    country: string
  }>
  location: {
    city: string
    state: string
    country: string
  }
  linkedinUrl: string
  seniority: string
  department: string
}

export interface LushaCompany {
  name: string
  domain: string
  website: string
  industry: string
  employeeCount: number
  revenue: string
  founded: number
  location: {
    city: string
    state: string
    country: string
  }
  phoneNumbers: string[]
  socialProfiles: {
    linkedin: string
    twitter: string
    facebook: string
  }
}

// =============================================================================
// Person Enrichment
// =============================================================================

/**
 * Enrich a single person with Lusha
 * Rate limit: 25 requests/second
 * Great for: Fast email + phone finding
 */
export async function enrichPerson(
  input: LushaPersonInput
): Promise<LushaPerson | null> {
  if (!LUSHA_API_KEY) {
    console.warn('[Lusha] API key not configured')
    return null
  }

  try {
    const response = await fetch(`${LUSHA_BASE_URL}/v2/person`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': LUSHA_API_KEY,
      },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Lusha API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('[Lusha] Person enrichment error:', error)
    return null
  }
}

/**
 * Bulk enrich people (up to 100 at once)
 * Rate limit: 25 requests/second
 */
export async function enrichPeopleBulk(
  inputs: LushaPersonInput[]
): Promise<Array<LushaPerson | null>> {
  if (!LUSHA_API_KEY) {
    console.warn('[Lusha] API key not configured')
    return []
  }

  try {
    const response = await fetch(`${LUSHA_BASE_URL}/v2/person/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': LUSHA_API_KEY,
      },
      body: JSON.stringify({
        records: inputs.slice(0, 100),
      }),
    })

    if (!response.ok) {
      throw new Error(`Lusha API error: ${response.status}`)
    }

    const data = await response.json()
    return data.records || []
  } catch (error) {
    console.error('[Lusha] Bulk enrichment error:', error)
    return []
  }
}

// =============================================================================
// Contact Finding
// =============================================================================

/**
 * Find email address for a person
 * Fastest option: 25 req/sec
 */
export async function findEmail(
  firstName: string,
  lastName: string,
  company: string
): Promise<string | null> {
  const enriched = await enrichPerson({
    firstName,
    lastName,
    company,
  })

  const workEmail = enriched?.emailAddresses?.find((e) => e.type === 'work')
  return workEmail?.email || enriched?.emailAddresses?.[0]?.email || null
}

/**
 * Find phone number for a person
 * Returns mobile number if available, otherwise work number
 */
export async function findPhone(
  firstName: string,
  lastName: string,
  company: string
): Promise<string | null> {
  const enriched = await enrichPerson({
    firstName,
    lastName,
    company,
  })

  const mobile = enriched?.phoneNumbers?.find((p) => p.type === 'mobile')
  return mobile?.number || enriched?.phoneNumbers?.[0]?.number || null
}

/**
 * Find both email and phone in one request
 */
export async function findContactInfo(
  firstName: string,
  lastName: string,
  company: string
): Promise<{ email: string | null; phone: string | null }> {
  const enriched = await enrichPerson({
    firstName,
    lastName,
    company,
  })

  const workEmail = enriched?.emailAddresses?.find((e) => e.type === 'work')
  const email = workEmail?.email || enriched?.emailAddresses?.[0]?.email || null

  const mobile = enriched?.phoneNumbers?.find((p) => p.type === 'mobile')
  const phone = mobile?.number || enriched?.phoneNumbers?.[0]?.number || null

  return { email, phone }
}

// =============================================================================
// Company Enrichment
// =============================================================================

/**
 * Enrich company data
 */
export async function enrichCompany(
  domain: string
): Promise<LushaCompany | null> {
  if (!LUSHA_API_KEY) {
    console.warn('[Lusha] API key not configured')
    return null
  }

  try {
    const response = await fetch(`${LUSHA_BASE_URL}/v2/company`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': LUSHA_API_KEY,
      },
      body: JSON.stringify({ domain }),
    })

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Lusha API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('[Lusha] Company enrichment error:', error)
    return null
  }
}

// =============================================================================
// Batch Processing with Rate Limiting
// =============================================================================

/**
 * Process batch of contacts with rate limiting (25 req/sec)
 */
export async function enrichContactsBatch(
  inputs: LushaPersonInput[],
  onProgress?: (completed: number, total: number) => void
): Promise<Array<LushaPerson | null>> {
  const results: Array<LushaPerson | null> = []
  const batchSize = 25 // 25 requests per second

  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize)

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map((input) => enrichPerson(input))
    )

    results.push(...batchResults)

    // Progress callback
    if (onProgress) {
      onProgress(results.length, inputs.length)
    }

    // Wait 1 second before next batch (rate limiting)
    if (i + batchSize < inputs.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  return results
}

// =============================================================================
// Prospecting & Search
// =============================================================================

/**
 * Search for people by criteria
 */
export async function searchPeople(params: {
  title?: string
  company?: string
  location?: string
  seniority?: string
  department?: string
  limit?: number
}): Promise<LushaPerson[]> {
  if (!LUSHA_API_KEY) {
    console.warn('[Lusha] API key not configured')
    return []
  }

  try {
    const response = await fetch(`${LUSHA_BASE_URL}/v2/person/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': LUSHA_API_KEY,
      },
      body: JSON.stringify({
        ...params,
        limit: params.limit || 100,
      }),
    })

    if (!response.ok) {
      throw new Error(`Lusha API error: ${response.status}`)
    }

    const data = await response.json()
    return data.results || []
  } catch (error) {
    console.error('[Lusha] Search error:', error)
    return []
  }
}

/**
 * Search for construction professionals
 */
export async function searchConstructionProfessionals(
  jobTitle: string,
  location: string,
  limit: number = 100
): Promise<LushaPerson[]> {
  return await searchPeople({
    title: jobTitle,
    location,
    limit,
  })
}

// =============================================================================
// Signals API (Job Changes)
// =============================================================================

/**
 * Get people who recently changed jobs
 * Great for: Finding candidates open to new opportunities
 */
export async function getRecentJobChanges(params: {
  industry?: string
  location?: string
  previousCompany?: string
  newTitle?: string
  daysAgo?: number
  limit?: number
}): Promise<LushaPerson[]> {
  if (!LUSHA_API_KEY) {
    console.warn('[Lusha] API key not configured')
    return []
  }

  try {
    const response = await fetch(`${LUSHA_BASE_URL}/v2/signals/job-changes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': LUSHA_API_KEY,
      },
      body: JSON.stringify({
        ...params,
        daysAgo: params.daysAgo || 30,
        limit: params.limit || 100,
      }),
    })

    if (!response.ok) {
      throw new Error(`Lusha API error: ${response.status}`)
    }

    const data = await response.json()
    return data.results || []
  } catch (error) {
    console.error('[Lusha] Job changes error:', error)
    return []
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Validate email deliverability
 */
export function isEmailDeliverable(email: { status: string }): boolean {
  return email.status === 'valid'
}

/**
 * Get best contact method (mobile phone preferred)
 */
export function getBestContactMethod(
  person: LushaPerson
): { type: 'email' | 'phone'; value: string } | null {
  // Prefer mobile phone
  const mobile = person.phoneNumbers?.find((p) => p.type === 'mobile')
  if (mobile) {
    return { type: 'phone', value: mobile.number }
  }

  // Fallback to work email
  const workEmail = person.emailAddresses?.find((e) => e.type === 'work')
  if (workEmail) {
    return { type: 'email', value: workEmail.email }
  }

  // Any email
  if (person.emailAddresses?.[0]) {
    return { type: 'email', value: person.emailAddresses[0].email }
  }

  return null
}
