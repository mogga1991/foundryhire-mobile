import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { jobs } from '@/lib/db/schema'
import { eq, and, count, desc, asc, sql } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:jobs')

export async function GET(request: NextRequest) {
  try {
    const { companyId } = await requireCompanyAccess()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    // Single job fetch
    if (id) {
      const [job] = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, id), eq(jobs.companyId, companyId)))
        .limit(1)

      if (!job) {
        return NextResponse.json({ error: 'Job not found', data: null }, { status: 404 })
      }

      return NextResponse.json({ data: job, error: null })
    }

    // List jobs
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const perPage = parseInt(searchParams.get('per_page') ?? '50', 10)
    const sortBy = searchParams.get('sort_by') ?? 'created_at'
    const sortOrder = searchParams.get('sort_order') === 'asc'

    // Build conditions
    const conditions = [eq(jobs.companyId, companyId)]
    if (status && status !== 'all') {
      conditions.push(eq(jobs.status, status))
    }

    // Get total count
    const [countResult] = await db
      .select({ value: count() })
      .from(jobs)
      .where(and(...conditions))

    const total = countResult?.value ?? 0

    // Build order
    const orderCol = sortBy === 'title' ? jobs.title : sortBy === 'status' ? jobs.status : jobs.createdAt
    const orderDir = sortOrder ? asc(orderCol) : desc(orderCol)

    // Fetch paginated results
    const offset = (page - 1) * perPage
    const data = await db
      .select()
      .from(jobs)
      .where(and(...conditions))
      .orderBy(orderDir)
      .offset(offset)
      .limit(perPage)

    return NextResponse.json({
      data,
      total,
      page,
      per_page: perPage,
      total_pages: total ? Math.ceil(total / perPage) : 0,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'Company not found', data: null }, { status: 404 })
    }
    logger.error({ error }, 'Failed to fetch jobs')
    return NextResponse.json({ error: 'Internal server error', data: null }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { companyId } = await requireCompanyAccess()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

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

    const body = await request.json()

    const updateData: Record<string, unknown> = { updatedAt: new Date() }

    const fieldMap: Record<string, string> = {
      title: 'title',
      department: 'department',
      location: 'location',
      employment_type: 'employmentType',
      experience_level: 'experienceLevel',
      salary_min: 'salaryMin',
      salary_max: 'salaryMax',
      salary_currency: 'salaryCurrency',
      description: 'description',
      requirements: 'requirements',
      responsibilities: 'responsibilities',
      benefits: 'benefits',
      skills_required: 'skillsRequired',
      skills_preferred: 'skillsPreferred',
      status: 'status',
      closes_at: 'closesAt',
    }

    for (const [bodyKey, schemaKey] of Object.entries(fieldMap)) {
      if (body[bodyKey] !== undefined) {
        if (bodyKey === 'salary_min' || bodyKey === 'salary_max') {
          updateData[schemaKey] = body[bodyKey] ? Number(body[bodyKey]) : null
        } else if (bodyKey === 'closes_at') {
          updateData[schemaKey] = body[bodyKey] ? new Date(body[bodyKey]) : null
        } else {
          updateData[schemaKey] = body[bodyKey]
        }
      }
    }

    // Handle publish logic
    if (body.status === 'active') {
      updateData.publishedAt = new Date()
    }

    const [updated] = await db
      .update(jobs)
      .set(updateData)
      .where(and(eq(jobs.id, id), eq(jobs.companyId, companyId)))
      .returning()

    return NextResponse.json({ data: updated, error: null })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'Company not found', data: null }, { status: 404 })
    }
    logger.error({ error }, 'Failed to update job')
    return NextResponse.json({ error: 'Internal server error', data: null }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, companyId } = await requireCompanyAccess()

    const body = await request.json()

    if (!body.title || typeof body.title !== 'string' || body.title.trim().length < 3) {
      return NextResponse.json(
        { error: 'Job title is required and must be at least 3 characters', data: null },
        { status: 400 }
      )
    }

    const [newJob] = await db
      .insert(jobs)
      .values({
        companyId,
        createdBy: user.id,
        title: body.title.trim(),
        department: body.department ?? null,
        location: body.location ?? null,
        employmentType: body.employment_type ?? null,
        experienceLevel: body.experience_level ?? null,
        salaryMin: body.salary_min ? Number(body.salary_min) : null,
        salaryMax: body.salary_max ? Number(body.salary_max) : null,
        salaryCurrency: body.salary_currency ?? 'USD',
        description: body.description ?? null,
        requirements: body.requirements ?? null,
        responsibilities: body.responsibilities ?? null,
        benefits: body.benefits ?? null,
        skillsRequired: body.skills_required ?? null,
        skillsPreferred: body.skills_preferred ?? null,
        status: body.status === 'active' ? 'active' : 'draft',
        publishedAt: body.status === 'active' ? new Date() : null,
        closesAt: body.closes_at ? new Date(body.closes_at) : null,
      })
      .returning()

    // Handle auto-lead generation if requested
    let leadGenerationStatus = null
    if (body.auto_generate_leads && body.status === 'active' && body.title && body.location) {
      leadGenerationStatus = 'initiated'

      // Note: Lead generation will be triggered from the client-side in JobForm
      // This is more reliable than server-side fetch since we have proper session context
    }

    return NextResponse.json({
      data: newJob,
      error: null,
      leadGenerationStatus,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'Company not found', data: null }, { status: 404 })
    }
    logger.error({ error }, 'Failed to create job')
    return NextResponse.json({ error: 'Internal server error', data: null }, { status: 500 })
  }
}
