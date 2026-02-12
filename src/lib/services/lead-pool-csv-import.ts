import Papa from 'papaparse'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'
import type { ApifyCsvRow } from '@/lib/services/csv-import'

const logger = createLogger('service:lead-pool-csv-import')

export interface LeadPoolImportResult {
  totalRows: number
  validRows: number
  insertedOrUpdated: number
  skippedInvalid: number
  errors: Array<{ row: number; error: string }>
}

type ApifyCsvRowPartial = Partial<ApifyCsvRow>

interface LeadPoolLeadUpsert {
  company_id: string
  job_id: string | null
  created_by_user_id: string
  source: string | null
  external_id: string | null

  first_name: string | null
  last_name: string | null
  full_name: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  github_url: string | null
  portfolio_url: string | null

  current_title: string | null
  current_company: string | null
  location: string | null
  skills: string[]
  summary: string | null

  raw: Record<string, unknown>
}

function normalizeHeader(header: string): string {
  const h = header.replace(/^\uFEFF/, '').trim()
  if (h.startsWith('"') && h.endsWith('"') && h.length >= 2) return h.slice(1, -1).trim()
  return h
}

function parsePhone(phoneStr: string | null | undefined): string | null {
  if (!phoneStr || phoneStr.trim() === '') return null
  const parts = phoneStr.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length > 0) return parts[0]
  return phoneStr.trim() || null
}

function buildLocation(city?: string | null, state?: string | null, country?: string | null): string | null {
  const parts = [city, state, country].filter((p) => p && p.trim() !== '') as string[]
  return parts.length > 0 ? parts.join(', ') : null
}

function parseSkills(specialities: string | null | undefined): string[] {
  if (!specialities || specialities.trim() === '') return []
  return specialities
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 100)
}

function isApifyStatusRow(fullName: string | null | undefined): boolean {
  if (!fullName) return false
  return /[\u{1F534}\u{1F7E2}\u{1F7E1}]/u.test(fullName) || /refer to the log/i.test(fullName)
}

function mapRowToLeadPoolInsert(
  row: ApifyCsvRowPartial,
  companyId: string,
  jobId: string | null,
  createdByUserId: string
): LeadPoolLeadUpsert | null {
  let firstName = (row.firstName ?? '').trim()
  let lastName = (row.lastName ?? '').trim()
  const fullName = (row.fullName ?? '').trim()

  if (!firstName && !lastName && fullName) {
    const parts = fullName.split(/\s+/)
    firstName = parts[0] || ''
    lastName = parts.slice(1).join(' ') || ''
  }

  if (!firstName && !fullName) return null

  const email = (row.email ?? row.personal_email ?? '').trim().toLowerCase() || null

  const raw: Record<string, unknown> = {
    ...(row as Record<string, unknown>),
    _import: {
      format: 'apify_leads-scraper-ppe',
      importedAt: new Date().toISOString(),
    },
  }

  return {
    company_id: companyId,
    job_id: jobId,
    created_by_user_id: createdByUserId,
    source: 'csv_import',
    external_id: null,

    first_name: firstName || null,
    last_name: lastName || null,
    full_name: fullName || null,
    email,
    phone: parsePhone(row.phone_numbers ?? null),
    linkedin_url: row.linkedinUrl?.trim() || null,
    github_url: null,
    portfolio_url: null,
    current_title: row.position?.trim() || null,
    current_company: row.organizationName?.trim() || null,
    location: buildLocation(row.city ?? null, row.state ?? null, row.country ?? null),
    skills: parseSkills(row.organizationSpecialities ?? null),
    summary: null,

    raw,
  }
}

export async function importCsvToLeadPool(
  csvContent: string,
  companyId: string,
  jobId: string | null,
  createdByUserId: string
): Promise<LeadPoolImportResult> {
  const parsed = Papa.parse<ApifyCsvRowPartial>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
  })

  const rows = (parsed.data || []).filter((row) => {
    if (isApifyStatusRow(row.fullName)) return false
    if (!row.fullName && !row.firstName && !row.lastName && !row.email) return false
    return true
  })

  const result: LeadPoolImportResult = {
    totalRows: rows.length,
    validRows: 0,
    insertedOrUpdated: 0,
    skippedInvalid: 0,
    errors: [],
  }

  const inserts: LeadPoolLeadUpsert[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    if (isApifyStatusRow(row.fullName)) {
      result.skippedInvalid++
      continue
    }

    const mapped = mapRowToLeadPoolInsert(row, companyId, jobId, createdByUserId)
    if (!mapped) {
      result.skippedInvalid++
      result.errors.push({ row: i + 1, error: 'Missing name fields' })
      continue
    }

    inserts.push(mapped)
  }

  result.validRows = inserts.length
  if (inserts.length === 0) return result

  const supabase = createSupabaseAdminClient()

  // Upsert in two passes to get conflict handling where possible.
  // Rows without email will insert; duplicates are best handled by linkedin unique index.
  const withEmail = inserts.filter((r) => !!r.email)
  const withLinkedinNoEmail = inserts.filter((r) => !r.email && !!r.linkedin_url)
  const withoutEmailOrLinkedin = inserts.filter((r) => !r.email && !r.linkedin_url)

  const CHUNK = 500
  for (let i = 0; i < withEmail.length; i += CHUNK) {
    const chunk = withEmail.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('leads')
      .upsert(chunk, { onConflict: 'company_id,email', ignoreDuplicates: false })
    if (error) {
      logger.error({ message: 'Lead pool upsert failed (email)', error })
      result.errors.push({ row: i + 1, error: `Supabase upsert failed: ${error.message}` })
    } else {
      result.insertedOrUpdated += chunk.length
    }
  }

  for (let i = 0; i < withLinkedinNoEmail.length; i += CHUNK) {
    const chunk = withLinkedinNoEmail.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('leads')
      .upsert(chunk, { onConflict: 'company_id,linkedin_url', ignoreDuplicates: false })
    if (error) {
      logger.error({ message: 'Lead pool upsert failed (linkedin)', error })
      result.errors.push({ row: i + 1, error: `Supabase upsert failed: ${error.message}` })
    } else {
      result.insertedOrUpdated += chunk.length
    }
  }

  // For rows without both email and LinkedIn URL, we can only insert (no deterministic conflict key).
  // This can create duplicates; clients should dedupe upstream when possible.
  for (let i = 0; i < withoutEmailOrLinkedin.length; i += CHUNK) {
    const chunk = withoutEmailOrLinkedin.slice(i, i + CHUNK)
    const { error } = await supabase.from('leads').insert(chunk)
    if (error) {
      logger.error({ message: 'Lead pool insert failed (no email/linkedin)', error })
      result.errors.push({ row: i + 1, error: `Supabase insert failed: ${error.message}` })
    } else {
      result.insertedOrUpdated += chunk.length
    }
  }

  return result
}
