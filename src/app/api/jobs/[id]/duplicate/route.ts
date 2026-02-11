import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { jobs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('api:jobs:duplicate')

async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, companyId } = await requireCompanyAccess()
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Job ID is required', data: null }, { status: 400 })
    }

    // Fetch the existing job
    const [existingJob] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.companyId, companyId)))
      .limit(1)

    if (!existingJob) {
      return NextResponse.json({ error: 'Job not found', data: null }, { status: 404 })
    }

    // Create a duplicate with modified title and draft status
    const [duplicatedJob] = await db
      .insert(jobs)
      .values({
        companyId,
        createdBy: user.id,
        title: `${existingJob.title} (Copy)`,
        department: existingJob.department,
        location: existingJob.location,
        employmentType: existingJob.employmentType,
        experienceLevel: existingJob.experienceLevel,
        salaryMin: existingJob.salaryMin,
        salaryMax: existingJob.salaryMax,
        salaryCurrency: existingJob.salaryCurrency,
        description: existingJob.description,
        requirements: existingJob.requirements,
        responsibilities: existingJob.responsibilities,
        benefits: existingJob.benefits,
        skillsRequired: existingJob.skillsRequired,
        skillsPreferred: existingJob.skillsPreferred,
        status: 'draft', // Always create duplicates as drafts
        publishedAt: null,
        closesAt: null,
      })
      .returning()

    return NextResponse.json({ data: duplicatedJob, error: null }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'Company not found', data: null }, { status: 404 })
    }
    logger.error({ error, jobId: (await params).id }, 'Failed to duplicate job')
    return NextResponse.json({ error: 'Internal server error', data: null }, { status: 500 })
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
