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
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { companyUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { importCsvCandidates } from '@/lib/services/csv-import'
import type { MergeStrategy } from '@/lib/services/deduplication'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's company
    const [companyUser] = await db
      .select({ companyId: companyUsers.companyId })
      .from(companyUsers)
      .where(eq(companyUsers.userId, session.user.id))
      .limit(1)

    if (!companyUser) {
      return NextResponse.json(
        { error: 'No company found. Please set up your company first.' },
        { status: 400 }
      )
    }

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

    console.log('[CSV Import] Starting import:', {
      filename: file.name,
      size: `${(file.size / 1024).toFixed(1)}KB`,
      companyId: companyUser.companyId,
      jobId,
      mergeStrategy,
    })

    // Read file content
    const csvContent = await file.text()

    // Process import
    const result = await importCsvCandidates(csvContent, companyUser.companyId, jobId, {
      skipNoEmail: true,
      mergeStrategy,
    })

    console.log('[CSV Import] Complete:', {
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
    console.error('[CSV Import] Error:', error)
    return NextResponse.json(
      {
        error: 'CSV import failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
