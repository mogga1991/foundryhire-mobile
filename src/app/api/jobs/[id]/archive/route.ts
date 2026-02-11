import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { jobs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('api:jobs:archive')

async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Job ID is required', data: null }, { status: 400 })
    }

    // Verify job belongs to this company
    const [existing] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.companyId, companyId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Job not found', data: null }, { status: 404 })
    }

    // Update job status to closed (archived)
    const [updatedJob] = await db
      .update(jobs)
      .set({
        status: 'closed',
        updatedAt: new Date(),
      })
      .where(and(eq(jobs.id, id), eq(jobs.companyId, companyId)))
      .returning()

    return NextResponse.json({ data: updatedJob, error: null })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'Company not found', data: null }, { status: 404 })
    }
    logger.error({ error, jobId: (await params).id }, 'Failed to archive job')
    return NextResponse.json({ error: 'Internal server error', data: null }, { status: 500 })
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
