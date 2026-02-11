/**
 * API Route: CSV Import Candidates
 *
 * POST /api/candidates/import
 *
 * Accepts a CSV file upload and imports candidates into the database
 * with deduplication support. Supports the Apify leads-scraper-ppe format.
 *
 * FormData fields:
 * - file: CSV file (required, max 50MB)
 * - jobId: Associate imported candidates with a job (optional)
 * - mergeStrategy: 'keep_existing' | 'prefer_new' | 'merge_best' (optional, default: merge_best)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { importCsvCandidates } from '@/lib/services/csv-import'
import type { MergeStrategy } from '@/lib/services/deduplication'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('csv-import')

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

async function _POST(request: NextRequest) {
  try {
    // Rate limit: 5 imports per minute per IP
    const rateLimitResult = await rateLimit(request, {
      limit: 5,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })
    if (rateLimitResult) return rateLimitResult

    // Authenticate user and get company context
    const { user, companyId } = await requireCompanyAccess()

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const jobId = formData.get('jobId') as string | null
    const mergeStrategy = (formData.get('mergeStrategy') as MergeStrategy) || 'merge_best'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Only CSV files are supported' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 50MB limit' },
        { status: 400 }
      )
    }

    logger.info({
      message: 'CSV import starting',
      filename: file.name,
      size: `${(file.size / 1024).toFixed(1)}KB`,
      companyId,
      jobId,
      mergeStrategy,
      userId: user.id,
    })

    // Read file content
    const csvContent = await file.text()

    // Process import with company scoping
    const result = await importCsvCandidates(csvContent, companyId, jobId, {
      skipNoEmail: true,
      mergeStrategy,
    })

    logger.info({
      message: 'CSV import complete',
      companyId,
      totalRows: result.totalRows,
      inserted: result.inserted,
      updated: result.updated,
      skippedNoEmail: result.skippedNoEmail,
      duplicatesSkipped: result.duplicatesSkipped,
      errors: result.errors.length,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'No company set up. Please create your company in Settings first.' }, { status: 400 })
    }
    logger.error({ message: 'CSV import failed', error })
    return NextResponse.json(
      {
        error: 'CSV import failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
