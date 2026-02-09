import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { interviews, interviewTimeSlots, candidates, companies } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'

interface RouteParams {
  params: Promise<{ token: string }>
}

// GET /api/interviews/candidate/[token] - Get interview details and time slots for candidate
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params

    // Find the interview by candidate portal token
    const [interview] = await db
      .select({
        id: interviews.id,
        candidateId: interviews.candidateId,
        scheduledAt: interviews.scheduledAt,
        durationMinutes: interviews.durationMinutes,
        interviewType: interviews.interviewType,
        location: interviews.location,
        phoneNumber: interviews.phoneNumber,
        status: interviews.status,
        candidateFirstName: candidates.firstName,
        candidateLastName: candidates.lastName,
        candidateEmail: candidates.email,
        companyName: companies.name,
        companyId: interviews.companyId,
      })
      .from(interviews)
      .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
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
        { error: 'Interview not found or link expired' },
        { status: 404 }
      )
    }

    // Get suggested time slots for this interview (if not yet scheduled)
    let timeSlots: Array<{
      id: string
      startTime: Date
      endTime: Date
      aiOptimalityScore: number | null
      aiReasoning: string | null
      status: string
    }> = []
    if (interview.status === 'pending' || !interview.scheduledAt) {
      timeSlots = await db
        .select({
          id: interviewTimeSlots.id,
          startTime: interviewTimeSlots.startTime,
          endTime: interviewTimeSlots.endTime,
          aiOptimalityScore: interviewTimeSlots.aiOptimalityScore,
          aiReasoning: interviewTimeSlots.aiReasoning,
          status: interviewTimeSlots.status,
        })
        .from(interviewTimeSlots)
        .where(
          and(
            eq(interviewTimeSlots.candidateId, interview.candidateId),
            eq(interviewTimeSlots.companyId, interview.companyId)
          )
        )
        .orderBy(interviewTimeSlots.startTime)
        .limit(10)
    }

    return NextResponse.json({
      interview: {
        id: interview.id,
        candidateName: `${interview.candidateFirstName} ${interview.candidateLastName}`,
        candidateEmail: interview.candidateEmail,
        companyName: interview.companyName,
        scheduledAt: interview.scheduledAt,
        durationMinutes: interview.durationMinutes,
        interviewType: interview.interviewType,
        location: interview.location,
        phoneNumber: interview.phoneNumber,
        status: interview.status,
      },
      timeSlots: timeSlots.map((slot) => ({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        optimalityScore: slot.aiOptimalityScore,
        reasoning: slot.aiReasoning,
        status: slot.status,
        formattedDate: slot.startTime.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
        formattedTime: slot.startTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        }),
      })),
    })
  } catch (error) {
    console.error('Error fetching interview details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch interview details' },
      { status: 500 }
    )
  }
}

// POST /api/interviews/candidate/[token]/confirm - Candidate confirms a time slot
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params
    const { timeSlotId } = await request.json()

    if (!timeSlotId) {
      return NextResponse.json(
        { error: 'timeSlotId is required' },
        { status: 400 }
      )
    }

    // Find the interview by token
    const [interview] = await db
      .select({
        id: interviews.id,
        candidateId: interviews.candidateId,
        companyId: interviews.companyId,
      })
      .from(interviews)
      .where(
        and(
          eq(interviews.candidatePortalToken, token),
          gt(interviews.candidatePortalExpiresAt, new Date())
        )
      )
      .limit(1)

    if (!interview) {
      return NextResponse.json(
        { error: 'Interview not found or link expired' },
        { status: 404 }
      )
    }

    // Get the selected time slot
    const [timeSlot] = await db
      .select()
      .from(interviewTimeSlots)
      .where(eq(interviewTimeSlots.id, timeSlotId))
      .limit(1)

    if (!timeSlot) {
      return NextResponse.json({ error: 'Time slot not found' }, { status: 404 })
    }

    // Update interview with selected time
    await db
      .update(interviews)
      .set({
        scheduledAt: timeSlot.startTime,
        durationMinutes: Math.round(
          (timeSlot.endTime.getTime() - timeSlot.startTime.getTime()) / 60000
        ),
        status: 'confirmed',
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, interview.id))

    // Update time slot status
    await db
      .update(interviewTimeSlots)
      .set({ status: 'selected' })
      .where(eq(interviewTimeSlots.id, timeSlotId))

    // Mark other slots as rejected
    await db
      .update(interviewTimeSlots)
      .set({ status: 'rejected' })
      .where(
        and(
          eq(interviewTimeSlots.candidateId, interview.candidateId),
          eq(interviewTimeSlots.companyId, interview.companyId),
          eq(interviewTimeSlots.status, 'suggested')
        )
      )

    return NextResponse.json({
      success: true,
      scheduledAt: timeSlot.startTime,
    })
  } catch (error) {
    console.error('Error confirming interview time:', error)
    return NextResponse.json(
      { error: 'Failed to confirm interview time' },
      { status: 500 }
    )
  }
}
