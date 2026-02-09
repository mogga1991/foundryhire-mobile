import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { interviews, candidates, jobs, companies } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'

// GET /api/portal/[token] - Fetch interview details for candidate portal (public, no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Find interview by portal token that hasn't expired
    const [interview] = await db
      .select({
        id: interviews.id,
        scheduledAt: interviews.scheduledAt,
        durationMinutes: interviews.durationMinutes,
        zoomJoinUrl: interviews.zoomJoinUrl,
        status: interviews.status,
        interviewQuestions: interviews.interviewQuestions,
        candidatePortalExpiresAt: interviews.candidatePortalExpiresAt,
        candidateFirstName: candidates.firstName,
        candidateLastName: candidates.lastName,
        candidateEmail: candidates.email,
        jobTitle: jobs.title,
        jobLocation: jobs.location,
        jobDepartment: jobs.department,
        jobDescription: jobs.description,
        jobRequirements: jobs.requirements,
        jobSkillsRequired: jobs.skillsRequired,
        companyName: companies.name,
        companyWebsite: companies.website,
      })
      .from(interviews)
      .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
      .leftJoin(jobs, eq(interviews.jobId, jobs.id))
      .innerJoin(companies, eq(interviews.companyId, companies.id))
      .where(
        and(
          eq(interviews.candidatePortalToken, token),
          gt(interviews.candidatePortalExpiresAt, new Date())
        )
      )
      .limit(1)

    if (!interview) {
      return NextResponse.json(
        { error: 'Interview not found or portal link has expired' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      interview: {
        id: interview.id,
        scheduledAt: interview.scheduledAt,
        durationMinutes: interview.durationMinutes,
        zoomJoinUrl: interview.zoomJoinUrl,
        status: interview.status,
        questions: interview.interviewQuestions || [],
      },
      candidate: {
        firstName: interview.candidateFirstName,
        lastName: interview.candidateLastName,
      },
      job: interview.jobTitle ? {
        title: interview.jobTitle,
        location: interview.jobLocation,
        department: interview.jobDepartment,
        description: interview.jobDescription,
        requirements: interview.jobRequirements,
        skillsRequired: interview.jobSkillsRequired,
      } : null,
      company: {
        name: interview.companyName,
        website: interview.companyWebsite,
      },
    })
  } catch (error) {
    console.error('Error fetching portal data:', error)
    return NextResponse.json(
      { error: 'Failed to load interview details' },
      { status: 500 }
    )
  }
}
