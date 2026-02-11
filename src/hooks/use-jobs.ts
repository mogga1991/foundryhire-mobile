'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Job, JobUpdate } from '@/lib/types'

interface UseJobsOptions {
  status?: string
  companyId?: string
}

interface UseJobsReturn {
  data: Job[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

async function getCsrfToken(): Promise<string> {
  const csrfRes = await fetch('/api/csrf', {
    method: 'GET',
    cache: 'no-store',
    credentials: 'include',
  })

  if (!csrfRes.ok) {
    throw new Error('Failed to initialize secure request')
  }

  const csrfData = (await csrfRes.json()) as { token?: string }
  if (!csrfData.token) {
    throw new Error('Missing CSRF token')
  }

  return csrfData.token
}

export function useJobs(options: UseJobsOptions = {}): UseJobsReturn {
  const [data, setData] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (options.status && options.status !== 'all') {
        params.set('status', options.status)
      }

      const res = await fetch(`/api/jobs?${params.toString()}`)
      if (!res.ok) {
        const errData = await res.json()
        setError(errData.error || 'Failed to fetch jobs')
        return
      }

      const result = await res.json()
      setData(result.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs')
    } finally {
      setLoading(false)
    }
  }, [options.status])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  return { data, loading, error, refetch: fetchJobs }
}

interface UseJobReturn {
  data: Job | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useJob(id: string): UseJobReturn {
  const [data, setData] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJob = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/jobs?id=${id}`)
      if (!res.ok) {
        const errData = await res.json()
        setError(errData.error || 'Failed to fetch job')
        return
      }

      const result = await res.json()
      setData(result.data ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch job')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchJob()
  }, [fetchJob])

  return { data, loading, error, refetch: fetchJob }
}

interface UseCreateJobReturn {
  createJob: (job: Record<string, unknown>) => Promise<Job | null>
  loading: boolean
  error: string | null
}

export function useCreateJob(): UseCreateJobReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createJob = useCallback(async (job: Record<string, unknown>): Promise<Job | null> => {
    setLoading(true)
    setError(null)

    try {
      const csrfToken = await getCsrfToken()
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(job),
      })

      if (!res.ok) {
        const errData = await res.json()
        setError(errData.error || 'Failed to create job')
        return null
      }

      const result = await res.json()
      return result.data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create job'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { createJob, loading, error }
}

interface UseUpdateJobReturn {
  updateJob: (id: string, updates: JobUpdate) => Promise<Job | null>
  loading: boolean
  error: string | null
}

export function useUpdateJob(): UseUpdateJobReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateJob = useCallback(async (id: string, updates: JobUpdate): Promise<Job | null> => {
    setLoading(true)
    setError(null)

    try {
      const csrfToken = await getCsrfToken()
      const res = await fetch(`/api/jobs?id=${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        const errData = await res.json()
        setError(errData.error || 'Failed to update job')
        return null
      }

      const result = await res.json()
      return result.data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update job'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { updateJob, loading, error }
}
