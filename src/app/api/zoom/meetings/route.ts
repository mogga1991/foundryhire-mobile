import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { createZoomMeeting } from '@/lib/integrations/zoom'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:zoom:meetings')

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
const createZoomMeetingRequestSchema = z.object({
  topic: z.string().min(1),
  startTime: z.string().min(1),
  durationMinutes: z.number().int().min(1),
  timezone: z.string().optional(),
  agenda: z.string().optional(),
})

async function _POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { topic, startTime, durationMinutes, timezone, agenda } = createZoomMeetingRequestSchema.parse(body)

    const meeting = await createZoomMeeting({
      topic,
      startTime: new Date(startTime),
      durationMinutes,
      timezone,
      agenda,
    })

    return NextResponse.json(meeting)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    logger.error({ message: 'Error creating Zoom meeting', error })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create meeting' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
