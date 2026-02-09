import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { candidateReachOuts, candidateUsers } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logger'

const logger = createLogger('employer-reach-outs')

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const employerId = session.user.id

    // Fetch all reach-outs sent by this employer with candidate info
    const reachOuts = await db.select({
      id: candidateReachOuts.id,
      message: candidateReachOuts.message,
      status: candidateReachOuts.status,
      createdAt: candidateReachOuts.createdAt,
      readAt: candidateReachOuts.readAt,
      candidateId: candidateReachOuts.candidateId,
      candidateFirstName: candidateUsers.firstName,
      candidateLastName: candidateUsers.lastName,
      candidateEmail: candidateUsers.email,
      candidatePhone: candidateUsers.phone,
      candidateProfileImage: candidateUsers.profileImageUrl,
      candidateTitle: candidateUsers.currentTitle,
      candidateCompany: candidateUsers.currentCompany,
      candidateLocation: candidateUsers.location,
    })
      .from(candidateReachOuts)
      .leftJoin(candidateUsers, eq(candidateReachOuts.candidateId, candidateUsers.id))
      .where(eq(candidateReachOuts.employerId, employerId))
      .orderBy(desc(candidateReachOuts.createdAt))

    const formattedReachOuts = reachOuts.map(ro => ({
      id: ro.id,
      message: ro.message,
      status: ro.status,
      createdAt: ro.createdAt,
      readAt: ro.readAt,
      candidate: {
        id: ro.candidateId,
        firstName: ro.candidateFirstName || 'Unknown',
        lastName: ro.candidateLastName || '',
        email: ro.candidateEmail || '',
        phone: ro.candidatePhone,
        profileImageUrl: ro.candidateProfileImage,
        currentTitle: ro.candidateTitle,
        currentCompany: ro.candidateCompany,
        location: ro.candidateLocation,
      },
    }))

    logger.info(
      { employerId, count: formattedReachOuts.length },
      'Fetched employer reach-outs'
    )

    return NextResponse.json({
      success: true,
      reachOuts: formattedReachOuts,
    })
  } catch (error) {
    logger.error({ error }, 'Failed to fetch employer reach-outs')
    return NextResponse.json(
      { error: 'Failed to fetch reach-outs' },
      { status: 500 }
    )
  }
}
