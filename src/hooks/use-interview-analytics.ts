'use client'

import { useState, useEffect, useCallback } from 'react'

export type AnalyticsPeriod = 'week' | 'month' | 'quarter' | 'year'

export interface InterviewAnalytics {
  summary: {
    totalInterviews: number
    completedInterviews: number
    averageScore: number
    averageDuration: number
    completionRate: number
    biasFlags: number
  }
  timeSeries: Array<{
    date: string
    interviews: number
    completions: number
    averageScore: number
  }>
  competencyBreakdown: Record<string, {
    averageScore: number
    count: number
  }>
  interviewerStats: Array<{
    interviewerId: string
    interviewerName: string
    totalInterviews: number
    averageScore: number
    completionRate: number
  }>
}

interface UseInterviewAnalyticsOptions {
  period?: AnalyticsPeriod
  startDate?: string
  endDate?: string
}

interface UseInterviewAnalyticsReturn {
  analytics: InterviewAnalytics | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Hook to fetch interview analytics data
 *
 * @param options - Period or custom date range
 * @returns Analytics data, loading state, error, and refetch function
 */
export function useInterviewAnalytics(
  options: UseInterviewAnalyticsOptions = {}
): UseInterviewAnalyticsReturn {
  const { period = 'month', startDate, endDate } = options

  const [analytics, setAnalytics] = useState<InterviewAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (startDate && endDate) {
        params.set('startDate', startDate)
        params.set('endDate', endDate)
      } else {
        params.set('period', period)
      }

      const res = await fetch(`/api/interviews/analytics?${params.toString()}`)
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to fetch analytics')
      }

      const result = await res.json()
      setAnalytics(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch analytics'
      setError(message)
      setAnalytics(null)
    } finally {
      setIsLoading(false)
    }
  }, [period, startDate, endDate])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  return {
    analytics,
    isLoading,
    error,
    refetch: fetchAnalytics,
  }
}
