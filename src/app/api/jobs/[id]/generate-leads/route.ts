/**
 * API Route: Generate Leads for Specific Job
 *
 * POST /api/jobs/[id]/generate-leads
 *
 * This endpoint allows manual triggering of lead generation for a specific job.
 * It can be used to:
 * - Re-run lead generation for a job
 * - Generate more leads for an existing job
 * - Test lead generation for a newly created job
 */

import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { triggerLeadGenerationForJob, canGenerateLeadsForJob } from '@/lib/jobs/auto-lead-generation'

const logger = createLogger('api:jobs:generate-leads')

async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate and get company access
    const { companyId } = await requireCompanyAccess()

    // Await params in Next.js 16+
    const { id: jobId } = await params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    // Parse request body (optional parameters)
    const body = await request.json().catch(() => ({}))
    const maxLeads = body.maxLeads || 20

    logger.info({ message: 'Generate leads request', jobId, companyId, maxLeads })

    // =============================================================================
    // Validate that lead generation can be run for this job
    // =============================================================================

    const validation = await canGenerateLeadsForJob(jobId, companyId)

    if (!validation.canGenerate) {
      return NextResponse.json(
        {
          error: 'Cannot generate leads for this job',
          reason: validation.reason,
        },
        { status: 400 }
      )
    }

    // =============================================================================
    // Trigger lead generation
    // =============================================================================

    const stats = await triggerLeadGenerationForJob(jobId, companyId, maxLeads)

    logger.info({ message: 'Generate leads succeeded', stats })

    return NextResponse.json({
      success: true,
      stats: {
        jobId: stats.jobId,
        jobTitle: stats.jobTitle,
        totalLeadsGenerated: stats.totalLeadsGenerated,
        savedToDatabase: stats.savedToDatabase,
        emailsFound: stats.emailsFound,
        phonesFound: stats.phonesFound,
        avgDataCompleteness: stats.avgDataCompleteness,
        avgMatchScore: stats.avgMatchScore,
        estimatedCost: stats.estimatedCost,
        apiUsage: stats.apiUsage,
        remainingApifyCredits: stats.remainingApifyCredits,
      },
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    logger.error({ message: 'Generate leads failed', error })

    return NextResponse.json(
      {
        error: 'Lead generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
