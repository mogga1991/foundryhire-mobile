/**
 * Interview Report API
 *
 * Generates a shareable HTML report for a single interview.
 * Can be opened in browser, printed to PDF, or shared.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { interviews } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateInterviewHtmlReport } from '@/lib/services/interview-export'
import { createLogger } from '@/lib/logger'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'

const logger = createLogger('interview-report-api')

// GET /api/interviews/[id]/report - Generate shareable interview report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply rate limiting: 20 reports per minute
    const rateLimitResult = await rateLimit(request, {
      limit: 20,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })

    if (rateLimitResult) {
      return rateLimitResult
    }

    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params

    // Verify interview belongs to company
    const [interview] = await db
      .select({ id: interviews.id })
      .from(interviews)
      .where(and(
        eq(interviews.id, interviewId),
        eq(interviews.companyId, companyId)
      ))
      .limit(1)

    if (!interview) {
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      )
    }

    // Generate HTML report
    const htmlReport = await generateInterviewHtmlReport(interviewId)

    logger.info({
      message: 'Interview report generated',
      interviewId,
      companyId,
    })

    // Return HTML with print-friendly styles
    return new NextResponse(htmlReport, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, max-age=300', // Cache for 5 minutes
      },
    })
  } catch (error) {
    logger.error({
      message: 'Error generating interview report',
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (error instanceof Error && error.message === 'Interview not found') {
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
