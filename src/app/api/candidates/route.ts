import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { candidates, candidateActivities, jobs } from '@/lib/db/schema'
import { eq, and, or, ilike, desc, asc, count } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const { companyId } = await requireCompanyAccess()

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const status = searchParams.get('status')
    const sortField = searchParams.get('sortField') || 'ai_score'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('perPage') || '20')

    // Build conditions - always filter by company
    const conditions = [eq(candidates.companyId, companyId)]

    if (jobId) {
      // Verify job belongs to this company
      const [job] = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)))
        .limit(1)

      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }

      conditions.push(eq(candidates.jobId, jobId))
    }

    if (status && status !== 'all') {
      conditions.push(eq(candidates.status, status))
    }

    if (search && search.trim()) {
      conditions.push(
        or(
          ilike(candidates.firstName, `%${search}%`),
          ilike(candidates.lastName, `%${search}%`),
          ilike(candidates.currentTitle, `%${search}%`),
          ilike(candidates.currentCompany, `%${search}%`)
        )!
      )
    }

    // Count
    const [countResult] = await db
      .select({ value: count() })
      .from(candidates)
      .where(and(...conditions))

    const total = countResult?.value ?? 0

    // Sort
    const ascending = sortOrder === 'asc'
    let orderExpr
    if (sortField === 'first_name') {
      orderExpr = ascending ? asc(candidates.firstName) : desc(candidates.firstName)
    } else if (sortField === 'created_at') {
      orderExpr = ascending ? asc(candidates.createdAt) : desc(candidates.createdAt)
    } else {
      orderExpr = ascending ? asc(candidates.aiScore) : desc(candidates.aiScore)
    }

    const offset = (page - 1) * perPage
    const data = await db
      .select()
      .from(candidates)
      .where(and(...conditions))
      .orderBy(orderExpr)
      .offset(offset)
      .limit(perPage)

    return NextResponse.json({
      candidates: data,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'No company set up. Please create your company in Settings first.' }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, companyId } = await requireCompanyAccess()

    const body = await request.json()

    const { first_name, last_name, email } = body
    if (!first_name || !last_name) {
      return NextResponse.json(
        { error: 'Missing required fields: first_name, last_name' },
        { status: 400 }
      )
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }
    }

    const [data] = await db
      .insert(candidates)
      .values({
        companyId,
        jobId: body.job_id || null,
        firstName: body.first_name.trim(),
        lastName: body.last_name.trim(),
        email: body.email ? body.email.trim().toLowerCase() : null,
        phone: body.phone || null,
        linkedinUrl: body.linkedin_url || null,
        githubUrl: body.github_url || null,
        portfolioUrl: body.portfolio_url || null,
        currentTitle: body.current_title || null,
        currentCompany: body.current_company || null,
        location: body.location || null,
        experienceYears: body.experience_years || null,
        skills: body.skills || null,
        resumeUrl: body.resume_url || null,
        resumeText: body.resume_text || null,
        coverLetter: body.cover_letter || null,
        source: body.source || 'manual',
        status: body.status || 'new',
        stage: body.stage || 'applied',
        notes: body.notes || null,
      })
      .returning()

    // Log activity
    await db.insert(candidateActivities).values({
      candidateId: data.id,
      companyId,
      activityType: 'candidate_added',
      title: 'Candidate added',
      description: `Candidate was added to the pipeline via ${body.source || 'manual'}.`,
      performedBy: user.id,
    })

    return NextResponse.json({ candidate: data }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'No company set up. Please create your company in Settings first.' }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
