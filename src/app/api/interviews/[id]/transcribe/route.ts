import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { interviews } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { processTranscription } from '@/lib/services/recording-pipeline'
import { createLogger } from '@/lib/logger'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('transcribe-api')

// Rate limit: 5 requests per minute per company
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '60 s'),
  analytics: true,
})

// POST /api/interviews/[id]/transcribe - Manually trigger transcription
async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params

    // Rate limiting
    const { success, limit, remaining, reset } = await ratelimit.limit(
      `transcribe:${companyId}`
    )

    if (!success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          limit,
          remaining,
          reset,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          },
        }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    // Fetch interview
    const [interview] = await db
      .select({
        id: interviews.id,
        recordingUrl: interviews.recordingUrl,
        transcript: interviews.transcript,
        transcriptStatus: interviews.transcriptStatus,
      })
      .from(interviews)
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    // Check if recording URL exists
    if (!interview.recordingUrl) {
      logger.warn({ message: 'No recording URL available', interviewId })
      return NextResponse.json(
        { error: 'No recording available for transcription' },
        { status: 400 }
      )
    }

    // Check if transcript already exists (unless force=true)
    if (interview.transcript && interview.transcriptStatus === 'completed' && !force) {
      logger.info({ message: 'Transcript already exists', interviewId })
      return NextResponse.json({
        message: 'Transcript already exists. Use ?force=true to re-transcribe.',
        status: 'completed',
        transcript: interview.transcript,
      })
    }

    // Check if transcription is already in progress
    if (interview.transcriptStatus === 'processing') {
      logger.info({ message: 'Transcription already in progress', interviewId })
      return NextResponse.json({
        message: 'Transcription is already in progress',
        status: 'processing',
      })
    }

    // Trigger transcription
    logger.info({ message: 'Starting manual transcription', interviewId, force })

    // Process transcription in the background (fire and forget)
    processTranscription(interviewId).catch((error) => {
      logger.error({ message: 'Background transcription failed', interviewId, error })
    })

    return NextResponse.json({
      message: 'Transcription started',
      status: 'processing',
      interviewId,
    })
  } catch (error) {
    logger.error({ message: 'Error triggering transcription', error })

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to trigger transcription' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })

// GET /api/interviews/[id]/transcribe - Get transcription status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params

    // Fetch interview transcription status
    const [interview] = await db
      .select({
        id: interviews.id,
        transcript: interviews.transcript,
        transcriptStatus: interviews.transcriptStatus,
        transcriptProcessedAt: interviews.transcriptProcessedAt,
        recordingUrl: interviews.recordingUrl,
        recordingDuration: interviews.recordingDuration,
      })
      .from(interviews)
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    return NextResponse.json({
      status: interview.transcriptStatus,
      hasTranscript: !!interview.transcript,
      hasRecording: !!interview.recordingUrl,
      processedAt: interview.transcriptProcessedAt,
      duration: interview.recordingDuration,
    })
  } catch (error) {
    logger.error({ message: 'Error fetching transcription status', error })

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch transcription status' },
      { status: 500 }
    )
  }
}
