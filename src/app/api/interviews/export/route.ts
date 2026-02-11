/**
 * Interview Export API
 *
 * GET - Export single interview as HTML/PDF report
 * POST - Bulk CSV export of multiple interviews
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { interviews } from '@/lib/db/schema'
import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import { generateInterviewHtmlReport, generateInterviewsCsv } from '@/lib/services/interview-export'
import { createLogger } from '@/lib/logger'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('interview-export-api')

// GET /api/interviews/export?id=<id>&format=<html|pdf|csv>
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting: 10 exports per minute
    const rateLimitResult = await rateLimit(request, {
      limit: 10,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })

    if (rateLimitResult) {
      return rateLimitResult
    }

    const { companyId } = await requireCompanyAccess()
    const url = new URL(request.url)

    const interviewId = url.searchParams.get('id')
    const format = url.searchParams.get('format') || 'html'

    if (!interviewId) {
      return NextResponse.json(
        { error: 'Interview ID is required' },
        { status: 400 }
      )
    }

    if (!['html', 'pdf', 'csv'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be html, pdf, or csv' },
        { status: 400 }
      )
    }

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

    // For HTML and PDF, return the HTML (browser can print to PDF)
    if (format === 'html' || format === 'pdf') {
      logger.info({
        message: 'Interview report generated',
        interviewId,
        format,
      })

      return new NextResponse(htmlReport, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `inline; filename="interview-report-${interviewId}.html"`,
        },
      })
    }

    // For CSV, export single interview
    if (format === 'csv') {
      const csv = await generateInterviewsCsv([interviewId], companyId)

      logger.info({
        message: 'Interview CSV generated',
        interviewId,
      })

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="interview-export-${interviewId}.csv"`,
        },
      })
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({
      message: 'Error exporting interview',
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Failed to export interview' },
      { status: 500 }
    )
  }
}

const bulkExportRequestSchema = z.object({
  interviewIds: z.array(z.string()).max(500).optional(),
  filters: z.object({
    status: z.union([z.string(), z.array(z.string())]).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    jobId: z.string().optional(),
  }).optional(),
})

// POST /api/interviews/export - Bulk CSV export
async function _POST(request: NextRequest) {
  try {
    // Apply rate limiting: 5 bulk exports per minute
    const rateLimitResult = await rateLimit(request, {
      limit: 5,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })

    if (rateLimitResult) {
      return rateLimitResult
    }

    const { companyId } = await requireCompanyAccess()
    const body = await request.json()
    const validatedBody = bulkExportRequestSchema.parse(body)

    const { interviewIds, filters } = validatedBody

    let idsToExport: string[] = []

    // If specific IDs provided, use those
    if (interviewIds && Array.isArray(interviewIds)) {
      if (interviewIds.length === 0) {
        return NextResponse.json(
          { error: 'No interview IDs provided' },
          { status: 400 }
        )
      }

      if (interviewIds.length > 500) {
        return NextResponse.json(
          { error: 'Maximum 500 interviews can be exported at once' },
          { status: 400 }
        )
      }

      idsToExport = interviewIds
    }
    // Otherwise, use filters to query
    else if (filters) {
      const conditions = [eq(interviews.companyId, companyId)]

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          conditions.push(inArray(interviews.status, filters.status))
        } else {
          conditions.push(eq(interviews.status, filters.status))
        }
      }

      if (filters.startDate) {
        conditions.push(gte(interviews.scheduledAt, new Date(filters.startDate)))
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate)
        endDate.setHours(23, 59, 59, 999)
        conditions.push(lte(interviews.scheduledAt, endDate))
      }

      if (filters.jobId) {
        conditions.push(eq(interviews.jobId, filters.jobId))
      }

      // Query interviews matching filters
      const matchingInterviews = await db
        .select({ id: interviews.id })
        .from(interviews)
        .where(and(...conditions))
        .limit(500) // Max 500

      idsToExport = matchingInterviews.map(i => i.id)

      if (idsToExport.length === 0) {
        return NextResponse.json(
          { error: 'No interviews match the provided filters' },
          { status: 404 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Either interviewIds or filters must be provided' },
        { status: 400 }
      )
    }

    // Generate CSV
    const csv = await generateInterviewsCsv(idsToExport, companyId)

    logger.info({
      message: 'Bulk CSV export generated',
      count: idsToExport.length,
      companyId,
    })

    const timestamp = new Date().toISOString().split('T')[0]

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="interviews-export-${timestamp}.csv"`,
      },
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    logger.error({
      message: 'Error bulk exporting interviews',
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Failed to export interviews' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
