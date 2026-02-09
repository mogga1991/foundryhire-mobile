import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { candidateReachOuts, users, companies } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getCandidateSession } from '@/lib/auth/candidate-session'
import { createLogger } from '@/lib/logger'

const logger = createLogger('candidate-reach-outs')

export async function GET(req: NextRequest) {
  try {
    const session = await getCandidateSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch all reach-outs for this candidate with employer and company info
    const reachOuts = await db.select({
      id: candidateReachOuts.id,
      message: candidateReachOuts.message,
      status: candidateReachOuts.status,
      createdAt: candidateReachOuts.createdAt,
      readAt: candidateReachOuts.readAt,
      employerName: users.name,
      employerEmail: users.email,
      employerImage: users.image,
      companyName: companies.name,
    })
      .from(candidateReachOuts)
      .leftJoin(users, eq(candidateReachOuts.employerId, users.id))
      .leftJoin(companies, eq(candidateReachOuts.companyId, companies.id))
      .where(eq(candidateReachOuts.candidateId, session.candidateId))
      .orderBy(desc(candidateReachOuts.createdAt))

    const formattedReachOuts = reachOuts.map(ro => ({
      id: ro.id,
      message: ro.message,
      status: ro.status,
      createdAt: ro.createdAt,
      readAt: ro.readAt,
      employer: {
        name: ro.employerName || 'Unknown Employer',
        email: ro.employerEmail || '',
        image: ro.employerImage,
      },
      company: ro.companyName ? {
        name: ro.companyName,
      } : null,
    }))

    logger.info(
      { candidateId: session.candidateId, count: formattedReachOuts.length },
      'Fetched candidate reach-outs'
    )

    return NextResponse.json({
      success: true,
      reachOuts: formattedReachOuts,
    })
  } catch (error) {
    logger.error({ error }, 'Failed to fetch reach-outs')
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}
