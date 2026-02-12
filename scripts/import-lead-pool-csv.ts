/**
 * Bulk import Apify leads-scraper-ppe CSV files into Supabase lead pool (public.leads).
 *
 * Usage:
 *   npm run leadpool:import -- --company-id <uuid> --dir "/path/to/csvs" [--job-id <uuid>] [--dry-run]
 *   npm run leadpool:import -- --company-id <uuid> --files "/path/a.csv,/path/b.csv"
 *
 * Env (server-side):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import dotenv from 'dotenv'
import Papa from 'papaparse'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

type ApifyCsvRow = Record<string, string | undefined>

interface LeadPoolLeadUpsert {
  company_id: string
  job_id: string | null
  created_by_user_id: string | null
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

function getArg(name: string): string | null {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return null
  return process.argv[idx + 1] ?? null
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

function normalizeHeader(header: string): string {
  const h = header.replace(/^\uFEFF/, '').trim()
  if (h.startsWith('"') && h.endsWith('"') && h.length >= 2) return h.slice(1, -1).trim()
  return h
}

function isApifyStatusRow(fullName: string | null | undefined): boolean {
  if (!fullName) return false
  return /[\u{1F534}\u{1F7E2}\u{1F7E1}]/u.test(fullName) || /refer to the log/i.test(fullName)
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

function mapRow(row: ApifyCsvRow, companyId: string, jobId: string | null): LeadPoolLeadUpsert | null {
  const fullName = (row.fullName || '').trim()
  let firstName = (row.firstName || '').trim()
  let lastName = (row.lastName || '').trim()

  if (!firstName && !lastName && fullName) {
    const parts = fullName.split(/\s+/)
    firstName = parts[0] || ''
    lastName = parts.slice(1).join(' ') || ''
  }

  if (!firstName && !fullName) return null

  const email = (row.email || row.personal_email || '').trim().toLowerCase() || null

  const raw: Record<string, unknown> = {
    ...row,
    _import: {
      format: 'apify_leads-scraper-ppe',
      importedAt: new Date().toISOString(),
    },
  }

  return {
    company_id: companyId,
    job_id: jobId,
    created_by_user_id: null,
    source: 'csv_bulk_import',
    external_id: null,

    first_name: firstName || null,
    last_name: lastName || null,
    full_name: fullName || null,
    email,
    phone: parsePhone(row.phone_numbers),
    linkedin_url: (row.linkedinUrl || '').trim() || null,
    github_url: null,
    portfolio_url: null,

    current_title: (row.position || '').trim() || null,
    current_company: (row.organizationName || '').trim() || null,
    location: buildLocation(row.city || null, row.state || null, row.country || null),
    skills: parseSkills(row.organizationSpecialities),
    summary: null,

    raw,
  }
}

async function listCsvFilesFromDir(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const e of entries) {
    if (!e.isFile()) continue
    if (!e.name.toLowerCase().endsWith('.csv')) continue
    files.push(path.join(dir, e.name))
  }
  files.sort()
  return files
}

async function main() {
  const companyId = getArg('--company-id')
  const jobIdArg = getArg('--job-id')
  const dir = getArg('--dir')
  const filesArg = getArg('--files')
  const dryRun = hasFlag('--dry-run')

  if (!companyId || !isUuid(companyId)) {
    throw new Error('Missing/invalid --company-id (expected UUID)')
  }
  const jobId = jobIdArg ? (isUuid(jobIdArg) ? jobIdArg : null) : null
  if (jobIdArg && !jobId) {
    throw new Error('Invalid --job-id (expected UUID)')
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment (.env.local).')
  }

  const filePaths: string[] = []
  if (dir) {
    filePaths.push(...await listCsvFilesFromDir(dir))
  }
  if (filesArg) {
    filePaths.push(...filesArg.split(',').map((p) => p.trim()).filter(Boolean))
  }
  if (filePaths.length === 0) {
    throw new Error('No input files. Provide --dir or --files.')
  }

  console.log(`Files: ${filePaths.length}`)
  console.log(`Company: ${companyId}`)
  console.log(`Job: ${jobId ?? '(none)'}`)
  console.log(`Dry run: ${dryRun ? 'yes' : 'no'}`)

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  let totalRows = 0
  let validRows = 0
  let insertedOrUpdated = 0
  let skippedInvalid = 0
  let errors = 0

  const CHUNK = 500

  for (const filePath of filePaths) {
    const content = await fs.readFile(filePath, 'utf-8')
    const parsed = Papa.parse<ApifyCsvRow>(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
    })

    const rows = (parsed.data || []).filter((r) => {
      if (isApifyStatusRow(r.fullName)) return false
      if (!r.fullName && !r.firstName && !r.lastName && !r.email) return false
      return true
    })

    totalRows += rows.length

    const inserts: LeadPoolLeadUpsert[] = []
    for (const r of rows) {
      const mapped = mapRow(r, companyId, jobId)
      if (!mapped) {
        skippedInvalid++
        continue
      }
      inserts.push(mapped)
    }

    validRows += inserts.length

    console.log(`\n${path.basename(filePath)}: rows=${rows.length} valid=${inserts.length}`)
    if (dryRun || inserts.length === 0) continue

    const withEmail = inserts.filter((r) => !!r.email)
    const withLinkedinNoEmail = inserts.filter((r) => !r.email && !!r.linkedin_url)
    const withoutEmailOrLinkedin = inserts.filter((r) => !r.email && !r.linkedin_url)

    for (let i = 0; i < withEmail.length; i += CHUNK) {
      const chunk = withEmail.slice(i, i + CHUNK)
      const { error } = await supabase
        .from('leads')
        .upsert(chunk, { onConflict: 'company_id,email', ignoreDuplicates: false })
      if (error) {
        errors++
        console.error(`Upsert(email) failed (${path.basename(filePath)}): ${error.message}`)
      } else {
        insertedOrUpdated += chunk.length
      }
    }

    for (let i = 0; i < withLinkedinNoEmail.length; i += CHUNK) {
      const chunk = withLinkedinNoEmail.slice(i, i + CHUNK)
      const { error } = await supabase
        .from('leads')
        .upsert(chunk, { onConflict: 'company_id,linkedin_url', ignoreDuplicates: false })
      if (error) {
        errors++
        console.error(`Upsert(linkedin) failed (${path.basename(filePath)}): ${error.message}`)
      } else {
        insertedOrUpdated += chunk.length
      }
    }

    for (let i = 0; i < withoutEmailOrLinkedin.length; i += CHUNK) {
      const chunk = withoutEmailOrLinkedin.slice(i, i + CHUNK)
      const { error } = await supabase.from('leads').insert(chunk)
      if (error) {
        errors++
        console.error(`Insert(no keys) failed (${path.basename(filePath)}): ${error.message}`)
      } else {
        insertedOrUpdated += chunk.length
      }
    }
  }

  console.log('\nDone')
  console.log(JSON.stringify({ totalRows, validRows, insertedOrUpdated, skippedInvalid, errors }, null, 2))
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})

