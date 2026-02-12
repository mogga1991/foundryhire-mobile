/**
 * API Route: CSV Import to Supabase Lead Pool
 *
 * POST /api/leads/pool/import
 *
 * Accepts a CSV file upload (Apify leads-scraper-ppe format) and imports
 * rows into Supabase `public.leads` as a lead pool for fallback matching.
 *
 * FormData fields:
 * - file: CSV file (required, max 50MB)
 * - jobId: Optional job UUID to associate imported leads
 */

import { NextRequest, NextResponse } from 'next/server'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { importCsvToLeadPool } from '@/lib/services/lead-pool-csv-import'

const logger = createLogger('api:leads:pool:import')

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

async function _POST(request: NextRequest) {
  try {
    // Rate limit: 3 imports per minute per IP
    const rateLimitResult = await rateLimit(request, {
      limit: 3,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })
    if (rateLimitResult) return rateLimitResult

    const { user, companyId } = await requireCompanyAccess()

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const jobIdRaw = (formData.get('jobId') as string | null) || null
    const jobId = jobIdRaw && isUuid(jobIdRaw) ? jobIdRaw : null

    if (jobIdRaw && !jobId) {
      return NextResponse.json({ error: 'Invalid jobId (expected UUID)' }, { status: 400 })
    }

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: 'Only CSV files are supported' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 50MB limit' }, { status: 400 })
    }

    logger.info({
      message: 'Lead pool CSV import starting',
      filename: file.name,
      sizeKb: Math.round(file.size / 1024),
      companyId,
      jobId,
      userId: user.id,
    })

    const csvContent = await file.text()
    const result = await importCsvToLeadPool(csvContent, companyId, jobId, user.id)

    logger.info({
      message: 'Lead pool CSV import complete',
      companyId,
      totalRows: result.totalRows,
      validRows: result.validRows,
      insertedOrUpdated: result.insertedOrUpdated,
      skippedInvalid: result.skippedInvalid,
      errors: result.errors.length,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json(
        { error: 'No company set up. Please create your company in Settings first.' },
        { status: 400 }
      )
    }

    logger.error({ message: 'Lead pool CSV import failed', error })
    return NextResponse.json(
      {
        error: 'Lead pool CSV import failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })

