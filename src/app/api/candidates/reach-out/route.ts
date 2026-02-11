import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { candidateReachOuts, candidateUsers, companyUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('candidate-reach-out')

const reachOutSchema = z.object({
  candidateId: z.string().uuid('Invalid candidate ID'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(1000, 'Message must be less than 1000 characters'),
})

async function _POST(req: NextRequest) {
  try {
    // Get employer session
    const session = await getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const employerId = session.user.id

    const body = await req.json()
    const validatedData = reachOutSchema.parse(body)

    // Verify candidate exists
    const [candidate] = await db.select()
      .from(candidateUsers)
      .where(eq(candidateUsers.id, validatedData.candidateId))
      .limit(1)

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      )
    }

    // Get employer's company
    const [employerCompany] = await db.select({ companyId: companyUsers.companyId })
      .from(companyUsers)
      .where(eq(companyUsers.userId, employerId))
      .limit(1)

    // Create reach-out record
    const [reachOut] = await db.insert(candidateReachOuts)
      .values({
        candidateId: validatedData.candidateId,
        employerId,
        companyId: employerCompany?.companyId || null,
        message: validatedData.message,
        status: 'sent',
      })
      .returning()

    logger.info({
      message: 'Employer reached out to candidate',
      reachOutId: reachOut.id,
      candidateId: validatedData.candidateId,
      employerId,
    })

    // Send in-app notification to candidate (non-blocking)
    const { notifyCandidateReachOut } = await import('@/lib/services/notifications')
    notifyCandidateReachOut(
      validatedData.candidateId,
      employerId,
      employerCompany?.companyId || '',
      reachOut.id
    ).catch((err) => {
      logger.error({ message: 'Failed to send reach-out notification', error: err })
    })

    // Send email notification to candidate (non-blocking)
    const { sendReachOutNotification } = await import('@/lib/email/reach-out-notification')
    const { companies, users } = await import('@/lib/db/schema')

    // Fetch employer and company details for the email
    const [employer] = await db.select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, employerId))
      .limit(1)

    const employerName = employer?.name || employer?.email || 'An employer'

    let companyName = 'a company'
    if (employerCompany?.companyId) {
      const [company] = await db.select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, employerCompany.companyId))
        .limit(1)
      companyName = company?.name || 'a company'
    }

    // Construct portal URL - this should be the candidate portal URL
    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/candidate/reach-outs/${reachOut.id}`

    sendReachOutNotification({
      candidateEmail: candidate.email,
      candidateName: `${candidate.firstName} ${candidate.lastName}`,
      employerName,
      companyName,
      message: validatedData.message,
      portalUrl,
    }).catch((err) => {
      logger.error({ message: 'Failed to send reach-out email', error: err })
    })

    return NextResponse.json({
      success: true,
      reachOutId: reachOut.id,
      message: 'Message sent successfully',
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    logger.error({ error }, 'Failed to send reach-out')
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
