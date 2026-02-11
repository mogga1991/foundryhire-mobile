import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { interviews, users } from '@/lib/db/schema'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import { z } from 'zod'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:interview-analytics')

const querySchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

// GET /api/interviews/analytics - Get interview analytics
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting: 10 requests per minute per IP
    const rateLimitResult = await rateLimit(request, {
      limit: 10,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })

    if (rateLimitResult) {
      return rateLimitResult
    }

    const { companyId } = await requireCompanyAccess()
    const { searchParams } = request.nextUrl

    // Parse and validate query parameters
    const params = querySchema.parse({
      period: searchParams.get('period') || 'month',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    })

    // Calculate date range
    let startDate: Date
    let endDate = new Date()

    if (params.startDate && params.endDate) {
      startDate = new Date(params.startDate)
      endDate = new Date(params.endDate)
    } else {
      // Calculate based on period
      const now = new Date()
      switch (params.period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'quarter':
          const currentQuarter = Math.floor(now.getMonth() / 3)
          startDate = new Date(now.getFullYear(), currentQuarter * 3, 1)
          break
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1)
          break
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      }
    }

    // Fetch all interviews in the date range
    const interviewList = await db
      .select({
        id: interviews.id,
        scheduledAt: interviews.scheduledAt,
        status: interviews.status,
        durationMinutes: interviews.durationMinutes,
        aiSentimentScore: interviews.aiSentimentScore,
        aiCompetencyScores: interviews.aiCompetencyScores,
        scheduledBy: interviews.scheduledBy,
      })
      .from(interviews)
      .where(
        and(
          eq(interviews.companyId, companyId),
          gte(interviews.scheduledAt, startDate),
          lte(interviews.scheduledAt, endDate)
        )
      )
      .orderBy(desc(interviews.scheduledAt))

    // Calculate summary metrics
    const totalInterviews = interviewList.length
    const completedInterviews = interviewList.filter(i => i.status === 'completed').length
    const completionRate = totalInterviews > 0 ? (completedInterviews / totalInterviews) * 100 : 0

    // Calculate average score from competency scores
    const scoresWithCompetency = interviewList.filter(i => i.aiCompetencyScores)
    let totalScore = 0
    let scoreCount = 0

    scoresWithCompetency.forEach(interview => {
      const scores = interview.aiCompetencyScores as {
        technical?: number
        communication?: number
        safety?: number
        cultureFit?: number
      } | null

      if (scores) {
        const avgScore = (
          (scores.technical || 0) +
          (scores.communication || 0) +
          (scores.safety || 0) +
          (scores.cultureFit || 0)
        ) / 4
        totalScore += avgScore
        scoreCount++
      }
    })

    const averageScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0

    // Calculate average duration
    const interviewsWithDuration = interviewList.filter(i => i.durationMinutes)
    const averageDuration = interviewsWithDuration.length > 0
      ? Math.round(
          interviewsWithDuration.reduce((sum, i) => sum + (i.durationMinutes || 0), 0) /
          interviewsWithDuration.length
        )
      : 0

    // Count bias flags (low sentiment or inconsistent scores)
    const biasFlags = interviewList.filter(i => {
      if (!i.aiSentimentScore) return false
      if (i.aiSentimentScore < 40) return true

      const scores = i.aiCompetencyScores as {
        technical?: number
        communication?: number
        safety?: number
        cultureFit?: number
      } | null

      if (scores) {
        const scoreValues = [
          scores.technical || 0,
          scores.communication || 0,
          scores.safety || 0,
          scores.cultureFit || 0,
        ]
        const max = Math.max(...scoreValues)
        const min = Math.min(...scoreValues)
        // Flag if there's a large variance (>40 points)
        if (max - min > 40) return true
      }

      return false
    }).length

    // Generate time series data
    const timeSeries: Array<{
      date: string
      interviews: number
      completions: number
      averageScore: number
    }> = []

    // Group interviews by day
    const interviewsByDay = new Map<string, typeof interviewList>()
    interviewList.forEach(interview => {
      const dateKey = interview.scheduledAt.toISOString().split('T')[0]
      if (!interviewsByDay.has(dateKey)) {
        interviewsByDay.set(dateKey, [])
      }
      interviewsByDay.get(dateKey)?.push(interview)
    })

    // Create time series entries
    interviewsByDay.forEach((dayInterviews, dateKey) => {
      const completions = dayInterviews.filter(i => i.status === 'completed').length

      // Calculate average score for the day
      let dayTotalScore = 0
      let dayScoreCount = 0

      dayInterviews.forEach(interview => {
        const scores = interview.aiCompetencyScores as {
          technical?: number
          communication?: number
          safety?: number
          cultureFit?: number
        } | null

        if (scores) {
          const avgScore = (
            (scores.technical || 0) +
            (scores.communication || 0) +
            (scores.safety || 0) +
            (scores.cultureFit || 0)
          ) / 4
          dayTotalScore += avgScore
          dayScoreCount++
        }
      })

      const dayAverageScore = dayScoreCount > 0 ? Math.round(dayTotalScore / dayScoreCount) : 0

      timeSeries.push({
        date: dateKey,
        interviews: dayInterviews.length,
        completions,
        averageScore: dayAverageScore,
      })
    })

    // Sort time series by date
    timeSeries.sort((a, b) => a.date.localeCompare(b.date))

    // Competency breakdown
    const competencyBreakdown: Record<string, { averageScore: number; count: number }> = {
      technical: { averageScore: 0, count: 0 },
      communication: { averageScore: 0, count: 0 },
      safety: { averageScore: 0, count: 0 },
      cultureFit: { averageScore: 0, count: 0 },
    }

    scoresWithCompetency.forEach(interview => {
      const scores = interview.aiCompetencyScores as {
        technical?: number
        communication?: number
        safety?: number
        cultureFit?: number
      } | null

      if (scores) {
        if (scores.technical) {
          competencyBreakdown.technical.averageScore += scores.technical
          competencyBreakdown.technical.count++
        }
        if (scores.communication) {
          competencyBreakdown.communication.averageScore += scores.communication
          competencyBreakdown.communication.count++
        }
        if (scores.safety) {
          competencyBreakdown.safety.averageScore += scores.safety
          competencyBreakdown.safety.count++
        }
        if (scores.cultureFit) {
          competencyBreakdown.cultureFit.averageScore += scores.cultureFit
          competencyBreakdown.cultureFit.count++
        }
      }
    })

    // Calculate averages
    Object.keys(competencyBreakdown).forEach(key => {
      const data = competencyBreakdown[key]
      if (data.count > 0) {
        data.averageScore = Math.round(data.averageScore / data.count)
      }
    })

    // Interviewer stats
    const interviewerStatsMap = new Map<string, {
      interviewerId: string
      interviewerName: string
      totalInterviews: number
      completedInterviews: number
      totalScore: number
      scoreCount: number
    }>()

    // Group by interviewer (scheduledBy)
    for (const interview of interviewList) {
      if (!interview.scheduledBy) continue

      const key = interview.scheduledBy
      if (!interviewerStatsMap.has(key)) {
        interviewerStatsMap.set(key, {
          interviewerId: key,
          interviewerName: '', // Will be filled later
          totalInterviews: 0,
          completedInterviews: 0,
          totalScore: 0,
          scoreCount: 0,
        })
      }

      const stats = interviewerStatsMap.get(key)!
      stats.totalInterviews++
      if (interview.status === 'completed') {
        stats.completedInterviews++
      }

      const scores = interview.aiCompetencyScores as {
        technical?: number
        communication?: number
        safety?: number
        cultureFit?: number
      } | null

      if (scores) {
        const avgScore = (
          (scores.technical || 0) +
          (scores.communication || 0) +
          (scores.safety || 0) +
          (scores.cultureFit || 0)
        ) / 4
        stats.totalScore += avgScore
        stats.scoreCount++
      }
    }

    // Fetch interviewer names
    const interviewerIds = Array.from(interviewerStatsMap.keys())
    if (interviewerIds.length > 0) {
      const interviewers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(sql`${users.id} = ANY(${interviewerIds})`)

      interviewers.forEach(interviewer => {
        const stats = interviewerStatsMap.get(interviewer.id)
        if (stats) {
          stats.interviewerName = interviewer.name || interviewer.email
        }
      })
    }

    // Format interviewer stats
    const interviewerStats = Array.from(interviewerStatsMap.values()).map(stats => ({
      interviewerId: stats.interviewerId,
      interviewerName: stats.interviewerName,
      totalInterviews: stats.totalInterviews,
      averageScore: stats.scoreCount > 0 ? Math.round(stats.totalScore / stats.scoreCount) : 0,
      completionRate: stats.totalInterviews > 0
        ? Math.round((stats.completedInterviews / stats.totalInterviews) * 100)
        : 0,
    }))

    // Sort by total interviews
    interviewerStats.sort((a, b) => b.totalInterviews - a.totalInterviews)

    return NextResponse.json({
      summary: {
        totalInterviews,
        completedInterviews,
        averageScore,
        averageDuration,
        completionRate: Math.round(completionRate),
        biasFlags,
      },
      timeSeries,
      competencyBreakdown,
      interviewerStats,
    })
  } catch (error) {
    logger.error({ message: 'Error fetching interview analytics', error })

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Failed to fetch interview analytics' },
      { status: 500 }
    )
  }
}
