import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createZoomMeeting } from '@/lib/integrations/zoom'

/**
 * POST /api/zoom/meetings
 *
 * Create a new Zoom meeting
 *
 * Body: {
 *   topic: string,
 *   startTime: string (ISO date),
 *   durationMinutes: number,
 *   timezone?: string,
 *   agenda?: string
 * }
 *
 * Returns: {
 *   meetingId: string,
 *   joinUrl: string,
 *   startUrl: string,
 *   password: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { topic, startTime, durationMinutes, timezone, agenda } = body

    if (!topic || !startTime || !durationMinutes) {
      return NextResponse.json(
        { error: 'Missing required fields: topic, startTime, durationMinutes' },
        { status: 400 }
      )
    }

    const meeting = await createZoomMeeting({
      topic,
      startTime: new Date(startTime),
      durationMinutes,
      timezone,
      agenda,
    })

    return NextResponse.json(meeting)
  } catch (error) {
    console.error('Error creating Zoom meeting:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create meeting' },
      { status: 500 }
    )
  }
}
