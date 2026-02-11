import { NextRequest, NextResponse } from 'next/server'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { candidates, jobs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateJSON } from '@/lib/ai/claude'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:interview-suggest-times')

interface SuggestedSlot {
  startTime: string
  endTime: string
  optimalityScore: number
  reasoning: string
}

async function _POST(request: NextRequest) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { candidateId, jobId } = await request.json()

    if (!candidateId) {
      return NextResponse.json({ error: 'candidateId is required' }, { status: 400 })
    }

    // Fetch candidate details
    const [candidate] = await db
      .select({
        firstName: candidates.firstName,
        lastName: candidates.lastName,
        location: candidates.location,
        currentTitle: candidates.currentTitle,
      })
      .from(candidates)
      .where(eq(candidates.id, candidateId))
      .limit(1)

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    // Fetch job details if available
    let job = null
    if (jobId) {
      const [jobResult] = await db
        .select({
          title: jobs.title,
          location: jobs.location,
          department: jobs.department,
        })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1)
      job = jobResult
    }

    const now = new Date()

    const prompt = `You are an AI interview scheduling assistant for a recruitment platform.

CURRENT CONTEXT:
- Current Date/Time: ${now.toISOString()}
- Candidate: ${candidate.firstName} ${candidate.lastName}
- Candidate Location: ${candidate.location || 'Unknown'}
- Candidate Current Role: ${candidate.currentTitle || 'Unknown'}
${job ? `- Job Title: ${job.title}` : ''}
${job ? `- Job Location: ${job.location || 'Unknown'}` : ''}
${job ? `- Department: ${job.department || 'Unknown'}` : ''}

TASK: Suggest 5 optimal interview time slots for the next 7 business days.

OPTIMIZATION FACTORS:
1. Mid-morning (9-11 AM) or early afternoon (1-3 PM) is ideal
2. Tuesday through Thursday are preferred (avoid Monday mornings and Friday afternoons)
3. Consider candidate timezone if location is known
4. Allow at least 24 hours from now for preparation
5. Avoid lunch hour (12-1 PM)

For each time slot, provide:
- startTime: ISO 8601 format with timezone
- endTime: 30 minutes after start time, ISO 8601 format
- optimalityScore: 0-100 where 100 is perfect
- reasoning: One brief sentence explaining why this time is good

Return as JSON:
{
  "slots": [
    {
      "startTime": "ISO_DATE",
      "endTime": "ISO_DATE",
      "optimalityScore": 95,
      "reasoning": "Brief reason"
    }
  ]
}`

    const aiResponse = await generateJSON<{ slots: SuggestedSlot[] }>(prompt, 2000)

    // Format slots for the frontend
    const formattedSlots = (aiResponse.slots || []).map((slot) => ({
      id: crypto.randomUUID(),
      startTime: slot.startTime,
      endTime: slot.endTime,
      optimalityScore: slot.optimalityScore,
      reasoning: slot.reasoning,
      formattedDate: new Date(slot.startTime).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      formattedTime: new Date(slot.startTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }),
    }))

    return NextResponse.json({ slots: formattedSlots })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ message: 'Error suggesting interview times', error })
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Failed to suggest interview times' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
