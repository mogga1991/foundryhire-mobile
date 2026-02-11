'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export type InterviewStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
export type InterviewType = 'video' | 'phone' | 'in_person'

export interface Interview {
  id: string
  candidateId: string
  jobId: string | null
  scheduledAt: string
  durationMinutes: number
  status: InterviewStatus
  zoomJoinUrl: string | null
  zoomMeetingId: string | null
  zoomStartUrl: string | null
  recordingUrl: string | null
  transcript: string | null
  aiSummary: string | null
  aiSentimentScore: number | null
  aiCompetencyScores: {
    technical: number
    communication: number
    safety: number
    cultureFit: number
  } | null
  interviewQuestions: Array<{
    id: string
    question: string
    answer?: string
    completed: boolean
  }> | null
  interviewType: InterviewType
  location: string | null
  phoneNumber: string | null
  passcode: string | null
  createdAt: string
  updatedAt?: string
  candidateFirstName?: string
  candidateLastName?: string
  candidateEmail?: string
  jobTitle?: string | null
}

interface UseInterviewsOptions {
  status?: InterviewStatus
  candidateId?: string
}

interface UseInterviewsReturn {
  interviews: Interview[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Hook to fetch and manage a list of interviews
 *
 * @param options - Optional filters for status and candidateId
 * @returns Interview list, loading state, error, and refetch function
 */
export function useInterviews(options: UseInterviewsOptions = {}): UseInterviewsReturn {
  const { status, candidateId } = options

  const [interviews, setInterviews] = useState<Interview[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInterviews = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (candidateId) params.set('candidateId', candidateId)

      const res = await fetch(`/api/interviews?${params.toString()}`)
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to fetch interviews')
      }

      const result = await res.json()
      setInterviews(result.interviews || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch interviews'
      setError(message)
      setInterviews([])
    } finally {
      setIsLoading(false)
    }
  }, [status, candidateId])

  useEffect(() => {
    fetchInterviews()
  }, [fetchInterviews])

  return {
    interviews,
    isLoading,
    error,
    refetch: fetchInterviews,
  }
}

interface UseInterviewDetailOptions {
  enablePolling?: boolean
  pollingInterval?: number
}

interface UseInterviewDetailReturn {
  interview: Interview | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Hook to fetch detailed information about a single interview
 *
 * Includes polling option for real-time status updates during active interviews
 *
 * @param interviewId - The interview ID to fetch
 * @param options - Optional configuration (polling interval, etc.)
 * @returns Interview details, loading state, error, and refetch function
 */
export function useInterviewDetail(
  interviewId: string,
  options: UseInterviewDetailOptions = {}
): UseInterviewDetailReturn {
  const { enablePolling = false, pollingInterval = 10000 } = options

  const [interview, setInterview] = useState<Interview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchInterview = useCallback(async () => {
    if (!interviewId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/interviews/${interviewId}`)
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to fetch interview')
      }

      const result = await res.json()
      setInterview(result.interview)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch interview'
      setError(message)
      setInterview(null)
    } finally {
      setIsLoading(false)
    }
  }, [interviewId])

  useEffect(() => {
    fetchInterview()
  }, [fetchInterview])

  // Polling logic for in-progress interviews
  useEffect(() => {
    // Clear any existing polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }

    // Only poll if enabled and interview is in progress
    const shouldPoll = enablePolling && interview?.status === 'in_progress'

    if (shouldPoll) {
      pollingIntervalRef.current = setInterval(() => {
        fetchInterview()
      }, pollingInterval)
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [enablePolling, interview?.status, pollingInterval, fetchInterview])

  return {
    interview,
    isLoading,
    error,
    refetch: fetchInterview,
  }
}

interface UseZoomSignatureOptions {
  portalToken?: string
  lazy?: boolean
}

interface UseZoomSignatureReturn {
  signature: string | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Hook to fetch Zoom SDK signature for embedding meetings
 *
 * Supports both authenticated users (via session cookie) and
 * candidate portal access (via Bearer token)
 *
 * @param meetingNumber - The Zoom meeting ID (required)
 * @param role - 0 for participant, 1 for host
 * @param options - Optional portal token for candidate access and lazy loading
 * @returns Signature, loading state, error, and refetch function
 */
export function useZoomSignature(
  meetingNumber: string | null | undefined,
  role: 0 | 1,
  options: UseZoomSignatureOptions = {}
): UseZoomSignatureReturn {
  const { portalToken, lazy = false } = options

  const [signature, setSignature] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSignature = useCallback(async () => {
    if (!meetingNumber) {
      setError('Meeting number is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' }

      // Add Bearer token for portal access if provided
      if (portalToken) {
        headers['Authorization'] = `Bearer ${portalToken}`
      }

      const res = await fetch('/api/zoom/signature', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          meetingNumber,
          role,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to generate signature')
      }

      const result = await res.json()
      setSignature(result.signature)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate signature'
      setError(message)
      setSignature(null)
    } finally {
      setIsLoading(false)
    }
  }, [meetingNumber, role, portalToken])

  useEffect(() => {
    // Only fetch if not lazy mode and meetingNumber is provided
    if (!lazy && meetingNumber) {
      fetchSignature()
    }
  }, [lazy, meetingNumber, fetchSignature])

  return {
    signature,
    isLoading,
    error,
    refetch: fetchSignature,
  }
}
