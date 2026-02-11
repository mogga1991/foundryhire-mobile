/**
 * API Route: Data Retention Cron Job
 *
 * GET /api/cron/data-retention
 *
 * Automatically processes data retention cleanup for all companies.
 * Triggered via Vercel Cron (weekly or daily).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'
import { db } from '@/lib/db'
import { companies, gdprAuditLog } from '@/lib/db/schema'
import { processDataRetention } from '@/lib/services/gdpr-compliance'
import { safeCompare } from '@/lib/security/timing-safe'

const logger = createLogger('cron:data-retention')

// Default retention period in days (can be made configurable per company)
const DEFAULT_RETENTION_DAYS = 365

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const cronSecret = request.headers.get('x-cron-secret')
    const expectedSecret = env.CRON_SECRET

    if (!cronSecret || !expectedSecret || !safeCompare(cronSecret, expectedSecret)) {
      logger.warn({ message: 'Unauthorized cron request' })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info({ message: 'Starting data retention cleanup cron job' })

    // Get all companies
    const allCompanies = await db.select({ id: companies.id, name: companies.name }).from(companies)

    logger.info({
      message: 'Processing data retention for companies',
      count: allCompanies.length,
    })

    const results = []
    let totalInterviewsProcessed = 0
    let totalRecordingsDeleted = 0
    let totalTranscriptsCleared = 0

    for (const company of allCompanies) {
      try {
        logger.info({
          message: 'Processing data retention for company',
          companyId: company.id,
          companyName: company.name,
        })

        // Process data retention for this company
        // TODO: In the future, fetch company-specific retention settings
        const retentionResult = await processDataRetention(company.id, DEFAULT_RETENTION_DAYS)

        totalInterviewsProcessed += retentionResult.interviewsProcessed
        totalRecordingsDeleted += retentionResult.recordingsDeleted
        totalTranscriptsCleared += retentionResult.transcriptsCleared

        // Create audit log entry
        await db.insert(gdprAuditLog).values({
          companyId: company.id,
          action: 'data_retention_cleanup',
          targetType: 'bulk',
          targetId: null,
          requestedBy: 'system', // System-initiated cron job
          details: {
            retentionDays: DEFAULT_RETENTION_DAYS,
            interviewsProcessed: retentionResult.interviewsProcessed,
            recordingsDeleted: retentionResult.recordingsDeleted,
            transcriptsCleared: retentionResult.transcriptsCleared,
            errors: retentionResult.errors,
          },
          completedAt: new Date(),
        })

        results.push({
          companyId: company.id,
          companyName: company.name,
          success: true,
          ...retentionResult,
        })

        logger.info({
          message: 'Data retention completed for company',
          companyId: company.id,
          interviewsProcessed: retentionResult.interviewsProcessed,
        })
      } catch (companyError) {
        logger.error({
          message: 'Error processing data retention for company',
          companyId: company.id,
          error: companyError,
        })

        results.push({
          companyId: company.id,
          companyName: company.name,
          success: false,
          error: companyError instanceof Error ? companyError.message : 'Unknown error',
        })
      }
    }

    logger.info({
      message: 'Data retention cron job completed',
      companiesProcessed: allCompanies.length,
      totalInterviewsProcessed,
      totalRecordingsDeleted,
      totalTranscriptsCleared,
    })

    return NextResponse.json({
      success: true,
      companiesProcessed: allCompanies.length,
      totalInterviewsProcessed,
      totalRecordingsDeleted,
      totalTranscriptsCleared,
      results,
    })
  } catch (error) {
    logger.error({ message: 'Error in data retention cron job', error })

    return NextResponse.json(
      {
        error: 'Failed to process data retention',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
