import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { jobs, candidates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:jobs:delete')

export async function DELETE(
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
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.companyId, companyId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Job not found', data: null }, { status: 404 })
    }

    // Check if there are candidates linked to this job
    const linkedCandidates = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(and(eq(candidates.jobId, id), eq(candidates.companyId, companyId)))
      .limit(1)

    if (linkedCandidates.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete job with linked candidates. Please remove candidates first or archive the job instead.',
          data: null,
        },
        { status: 400 }
      )
    }

    // Delete the job
    await db
      .delete(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.companyId, companyId)))

    return NextResponse.json({ data: { success: true }, error: null })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'Company not found', data: null }, { status: 404 })
    }
    logger.error({ error, jobId: (await params).id }, 'Failed to delete job')
    return NextResponse.json({ error: 'Internal server error', data: null }, { status: 500 })
  }
}
