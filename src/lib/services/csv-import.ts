/**
 * CSV Import Service
 *
 * Parses CSV files (particularly from Apify leads scraper) and imports
 * candidates into the database with deduplication support.
 *
 * Supports the 25-column Apify leads-scraper-ppe format:
 * fullName, firstName, lastName, email, personal_email, phone_numbers,
 * position, linkedinUrl, city, state, country, seniority, functional,
 * organizationName, organizationWebsite, organizationLinkedinUrl,
 * organizationFoundedYear, organizationIndustry, organizationSize,
 * organizationDescription, organizationSpecialities,
 * organizationCity, organizationState, organizationCountry, source
 */

import Papa from 'papaparse'
import {
  deduplicateBatch,
  type CandidateInput,
  type MergeStrategy,
} from './deduplication'

// =============================================================================
// Types
// =============================================================================

export interface ApifyCsvRow {
  fullName: string
  firstName: string
  lastName: string
  email: string
  personal_email: string
  phone_numbers: string
  position: string
  linkedinUrl: string
  city: string
  state: string
  country: string
  seniority: string
  functional: string
  organizationName: string
  organizationWebsite: string
  organizationLinkedinUrl: string
  organizationFoundedYear: string
  organizationIndustry: string
  organizationSize: string
  organizationDescription: string
  organizationSpecialities: string
  organizationCity: string
  organizationState: string
  organizationCountry: string
  source: string
}

export interface CsvImportResult {
  totalRows: number
  validRows: number
  skippedNoEmail: number
  inserted: number
  updated: number
  duplicatesSkipped: number
  errors: Array<{ row: number; error: string }>
}

// =============================================================================
// CSV Parsing
// =============================================================================

/**
 * Parse a CSV string into typed rows.
 * Filters out non-data rows like the Apify status message row.
 */
export function parseCsv(csvContent: string): ApifyCsvRow[] {
  const result = Papa.parse<ApifyCsvRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  })

  // Filter out non-data rows (Apify status messages contain emoji indicators)
  return result.data.filter((row) => {
    // Skip rows where fullName contains the Apify status emoji
    if (row.fullName && /[\u{1F534}\u{1F7E2}\u{1F7E1}]/u.test(row.fullName)) {
      return false
    }
    // Skip rows where all key fields are empty
    if (!row.fullName && !row.firstName && !row.lastName && !row.email) {
      return false
    }
    return true
  })
}

// =============================================================================
// Row Mapping
// =============================================================================

/**
 * Extract first phone number from the phone_numbers field.
 * The field can be a single number, comma-separated list, or JSON array.
 */
function parsePhone(phoneStr: string | null | undefined): string | null {
  if (!phoneStr || phoneStr.trim() === '') return null

  // Try comma-separated
  const parts = phoneStr.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length > 0) {
    return parts[0]
  }

  return phoneStr.trim() || null
}

/**
 * Build a location string from city, state, country.
 */
function buildLocation(
  city: string | null | undefined,
  state: string | null | undefined,
  country: string | null | undefined
): string | null {
  const parts = [city, state, country].filter((p) => p && p.trim() !== '')
  return parts.length > 0 ? parts.join(', ') : null
}

/**
 * Parse skills from the organizationSpecialities field.
 */
function parseSkills(specialities: string | null | undefined): string[] {
  if (!specialities || specialities.trim() === '') return []
  return specialities
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 100)
}

/**
 * Map a single CSV row to a CandidateInput for the deduplication service.
 * Returns null if the row is invalid (missing both name fields).
 */
export function mapCsvRowToCandidate(
  row: ApifyCsvRow,
  companyId: string,
  jobId: string | null
): CandidateInput | null {
  // Determine name fields
  let firstName = (row.firstName || '').trim()
  let lastName = (row.lastName || '').trim()

  // Fallback: split fullName if firstName/lastName empty
  if (!firstName && !lastName && row.fullName) {
    const parts = row.fullName.trim().split(/\s+/)
    firstName = parts[0] || ''
    lastName = parts.slice(1).join(' ') || ''
  }

  // Must have at least a first name
  if (!firstName) return null

  // Determine email (prefer work email, fall back to personal)
  const email = (row.email || row.personal_email || '').trim().toLowerCase()

  // Build company info JSONB
  const companyInfo: Record<string, unknown> = {}
  if (row.organizationName) companyInfo.name = row.organizationName.trim()
  if (row.organizationWebsite) companyInfo.domain = row.organizationWebsite.trim()
  if (row.organizationSize) companyInfo.size = row.organizationSize.trim()
  if (row.organizationIndustry) companyInfo.industry = row.organizationIndustry.trim()
  if (row.organizationDescription) companyInfo.description = row.organizationDescription.trim()
  if (row.organizationSpecialities) companyInfo.specialities = row.organizationSpecialities.trim()
  if (row.organizationFoundedYear) companyInfo.foundedYear = row.organizationFoundedYear.trim()

  // Build social profiles JSONB
  const socialProfiles: Record<string, unknown> = {}
  if (row.linkedinUrl) socialProfiles.linkedin = row.linkedinUrl.trim()
  if (row.organizationLinkedinUrl) socialProfiles.organizationLinkedin = row.organizationLinkedinUrl.trim()

  return {
    companyId,
    jobId: jobId || null,
    firstName,
    lastName: lastName || 'Unknown',
    email: email || null,
    phone: parsePhone(row.phone_numbers),
    linkedinUrl: row.linkedinUrl?.trim() || null,
    currentTitle: row.position?.trim() || null,
    currentCompany: row.organizationName?.trim() || null,
    location: buildLocation(row.city, row.state, row.country),
    skills: parseSkills(row.organizationSpecialities),
    source: 'csv_import',
    stage: 'sourced',
    dataCompleteness: 0, // Will be calculated below
    socialProfiles: Object.keys(socialProfiles).length > 0 ? socialProfiles : null,
    companyInfo: Object.keys(companyInfo).length > 0 ? companyInfo : null,
  }
}

/**
 * Calculate data completeness for a candidate input.
 */
function calculateDataCompleteness(input: CandidateInput): number {
  const fields = [
    input.email,
    input.phone,
    input.currentTitle,
    input.currentCompany,
    input.location,
    input.linkedinUrl,
    (input.skills && input.skills.length > 0) ? 'has_skills' : null,
  ]
  return Math.round((fields.filter(Boolean).length / fields.length) * 100)
}

// =============================================================================
// CSV Import Pipeline
// =============================================================================

/**
 * Full CSV import pipeline: parse → validate → map → deduplicate → insert.
 */
export async function importCsvCandidates(
  csvContent: string,
  companyId: string,
  jobId: string | null,
  options?: {
    skipNoEmail?: boolean
    mergeStrategy?: MergeStrategy
  }
): Promise<CsvImportResult> {
  const skipNoEmail = options?.skipNoEmail ?? true
  const mergeStrategy = options?.mergeStrategy ?? 'merge_best'

  // 1. Parse CSV
  const rows = parseCsv(csvContent)

  const result: CsvImportResult = {
    totalRows: rows.length,
    validRows: 0,
    skippedNoEmail: 0,
    inserted: 0,
    updated: 0,
    duplicatesSkipped: 0,
    errors: [],
  }

  // 2. Map and validate rows
  const candidateInputs: CandidateInput[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const mapped = mapCsvRowToCandidate(row, companyId, jobId)

    if (!mapped) {
      result.errors.push({ row: i + 1, error: 'Missing name fields' })
      continue
    }

    // Track rows without email
    if (!mapped.email) {
      if (skipNoEmail) {
        result.skippedNoEmail++
        continue
      }
      // Still allow import without email - enrichment will find it later
    }

    // Calculate data completeness
    mapped.dataCompleteness = calculateDataCompleteness(mapped)

    candidateInputs.push(mapped)
  }

  result.validRows = candidateInputs.length

  if (candidateInputs.length === 0) {
    return result
  }

  // 3. Batch process with deduplication (process in chunks of 50)
  const CHUNK_SIZE = 50

  for (let i = 0; i < candidateInputs.length; i += CHUNK_SIZE) {
    const chunk = candidateInputs.slice(i, i + CHUNK_SIZE)

    try {
      const { stats } = await deduplicateBatch(companyId, chunk, mergeStrategy)

      result.inserted += stats.inserted
      result.updated += stats.updated
      result.duplicatesSkipped += stats.skipped
    } catch (error) {
      // Log error but continue with next chunk
      console.error(`[CSV Import] Error processing chunk ${i / CHUNK_SIZE + 1}:`, error)
      result.errors.push({
        row: i + 1,
        error: `Chunk processing failed: ${error instanceof Error ? error.message : 'unknown'}`,
      })
    }
  }

  return result
}
