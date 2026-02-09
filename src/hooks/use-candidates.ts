'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Candidate, CandidateInsert, CandidateUpdate } from '@/lib/types'

export type CandidateSortField = 'ai_score' | 'first_name' | 'created_at'
export type CandidateSortOrder = 'asc' | 'desc'
export type CandidateStatusFilter =
  | 'all'
  | 'new'
  | 'contacted'
  | 'responded'
  | 'interviewing'
  | 'rejected'

interface UseCandidatesOptions {
  jobId: string
  sortField?: CandidateSortField
  sortOrder?: CandidateSortOrder
  statusFilter?: CandidateStatusFilter
  searchQuery?: string
  page?: number
  perPage?: number
}

interface UseCandidatesReturn {
  candidates: Candidate[]
  loading: boolean
  error: string | null
  total: number
  page: number
  totalPages: number
  refetch: () => Promise<void>
}

interface UseCandidateReturn {
  candidate: Candidate | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

interface UseCreateCandidateReturn {
  createCandidate: (data: CandidateInsert) => Promise<Candidate | null>
  loading: boolean
  error: string | null
}

interface UseUpdateCandidateReturn {
  updateCandidate: (id: string, data: CandidateUpdate) => Promise<Candidate | null>
  loading: boolean
  error: string | null
}

interface ScoreCandidateResult {
  score: number
  reasoning: string
  strengths: string[]
  concerns: string[]
  recommendation: string
  success: boolean
}

interface UseScoreCandidateReturn {
  scoreCandidate: (jobId: string, candidateProfile: Record<string, unknown>) => Promise<ScoreCandidateResult | null>
  loading: boolean
  error: string | null
}

interface AnalyzeResumeResult {
  summary: string
  skills: string[]
  experience: {
    title: string
    company: string
    duration: string
    description: string
  }[]
  education: {
    degree: string
    institution: string
    year: string
  }[]
  certifications: string[]
  greenFlags: string[]
  redFlags: string[]
  recommendation: string
  success: boolean
}

interface UseAnalyzeResumeReturn {
  analyzeResume: (resumeText: string, jobId: string) => Promise<AnalyzeResumeResult | null>
  loading: boolean
  error: string | null
}

export function useCandidates(options: UseCandidatesOptions): UseCandidatesReturn {
  const {
    jobId,
    sortField = 'ai_score',
    sortOrder = 'desc',
    statusFilter = 'all',
    searchQuery = '',
    page = 1,
    perPage = 20,
  } = options

  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  const fetchCandidates = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        jobId,
        sortField,
        sortOrder,
        page: String(page),
        perPage: String(perPage),
      })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (searchQuery.trim()) params.set('search', searchQuery)

      const res = await fetch(`/api/candidates?${params.toString()}`)
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to fetch candidates')
      }

      const result = await res.json()
      setCandidates(result.candidates || [])
      setTotal(result.total || 0)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch candidates'
      setError(message)
      setCandidates([])
    } finally {
      setLoading(false)
    }
  }, [jobId, sortField, sortOrder, statusFilter, searchQuery, page, perPage])

  useEffect(() => {
    fetchCandidates()
  }, [fetchCandidates])

  const totalPages = Math.ceil(total / perPage)

  return {
    candidates,
    loading,
    error,
    total,
    page,
    totalPages,
    refetch: fetchCandidates,
  }
}

export function useCandidate(id: string): UseCandidateReturn {
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCandidate = useCallback(async () => {
    if (!id) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/candidates/${id}`)
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to fetch candidate')
      }

      const result = await res.json()
      setCandidate(result.candidate)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch candidate'
      setError(message)
      setCandidate(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchCandidate()
  }, [fetchCandidate])

  return {
    candidate,
    loading,
    error,
    refetch: fetchCandidate,
  }
}

export function useCreateCandidate(): UseCreateCandidateReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createCandidate = useCallback(async (data: CandidateInsert): Promise<Candidate | null> => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to create candidate')
      }

      const result = await res.json()
      return result.candidate
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create candidate'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { createCandidate, loading, error }
}

export function useUpdateCandidate(): UseUpdateCandidateReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateCandidate = useCallback(
    async (id: string, data: CandidateUpdate): Promise<Candidate | null> => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/candidates/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Failed to update candidate')
        }

        const result = await res.json()
        return result.candidate
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update candidate'
        setError(message)
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { updateCandidate, loading, error }
}

export function useScoreCandidate(): UseScoreCandidateReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scoreCandidate = useCallback(
    async (
      jobId: string,
      candidateProfile: Record<string, unknown>
    ): Promise<ScoreCandidateResult | null> => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/ai/score-candidate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, candidateProfile }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to score candidate')
        }

        const result: ScoreCandidateResult = await response.json()
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to score candidate'
        setError(message)
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { scoreCandidate, loading, error }
}

export function useAnalyzeResume(): UseAnalyzeResumeReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyzeResume = useCallback(
    async (resumeText: string, jobId: string): Promise<AnalyzeResumeResult | null> => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/ai/analyze-resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeText, jobId }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to analyze resume')
        }

        const result: AnalyzeResumeResult = await response.json()
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to analyze resume'
        setError(message)
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { analyzeResume, loading, error }
}
