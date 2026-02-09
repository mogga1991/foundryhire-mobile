'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Campaign, CampaignSend, Candidate } from '@/lib/types'

interface UseCampaignsReturn {
  data: Campaign[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useCampaigns(jobId: string): UseCampaignsReturn {
  const [data, setData] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCampaigns = useCallback(async () => {
    if (!jobId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/campaigns?jobId=${jobId}`)
      if (!res.ok) {
        const errData = await res.json()
        setError(errData.error || 'Failed to fetch campaigns')
        return
      }

      const result = await res.json()
      setData(result.campaigns ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch campaigns')
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  return { data, loading, error, refetch: fetchCampaigns }
}

interface CampaignWithSends extends Campaign {
  campaign_sends: (CampaignSend & { candidates: Pick<Candidate, 'id' | 'firstName' | 'lastName' | 'email'> | null })[]
}

interface UseCampaignReturn {
  data: CampaignWithSends | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useCampaign(id: string): UseCampaignReturn {
  const [data, setData] = useState<CampaignWithSends | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCampaign = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/campaigns?id=${id}`)
      if (!res.ok) {
        const errData = await res.json()
        setError(errData.error || 'Failed to fetch campaign')
        return
      }

      const result = await res.json()
      setData(result.campaign as CampaignWithSends)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch campaign')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchCampaign()
  }, [fetchCampaign])

  return { data, loading, error, refetch: fetchCampaign }
}

interface CreateCampaignInput {
  name: string
  subject: string
  body: string
  jobId: string
  candidateIds: string[]
  campaignType?: string
  followUps?: {
    delayDays: number
    subject: string
    body: string
  }[]
}

interface UseCreateCampaignReturn {
  createCampaign: (input: CreateCampaignInput) => Promise<Campaign | null>
  loading: boolean
  error: string | null
}

export function useCreateCampaign(): UseCreateCampaignReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createCampaign = useCallback(async (input: CreateCampaignInput): Promise<Campaign | null> => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      if (!res.ok) {
        const errData = await res.json()
        setError(errData.error || 'Failed to create campaign')
        return null
      }

      const result = await res.json()
      return result.campaign
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create campaign'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { createCampaign, loading, error }
}

interface UseLaunchCampaignReturn {
  launchCampaign: (campaignId: string) => Promise<boolean>
  pauseCampaign: (campaignId: string) => Promise<boolean>
  resumeCampaign: (campaignId: string) => Promise<boolean>
  loading: boolean
  error: string | null
}

export function useLaunchCampaign(): UseLaunchCampaignReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const launchCampaign = useCallback(async (campaignId: string): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to launch campaign')
        return false
      }

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch campaign')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const pauseCampaign = useCallback(async (campaignId: string): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/campaigns?id=${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paused' }),
      })

      if (!res.ok) {
        const errData = await res.json()
        setError(errData.error || 'Failed to pause campaign')
        return false
      }

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause campaign')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const resumeCampaign = useCallback(async (campaignId: string): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/campaigns?id=${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      })

      if (!res.ok) {
        const errData = await res.json()
        setError(errData.error || 'Failed to resume campaign')
        return false
      }

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume campaign')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return { launchCampaign, pauseCampaign, resumeCampaign, loading, error }
}

interface GenerateEmailInput {
  jobId: string
  candidateId?: string
  jobTitle: string
  jobDescription?: string
  candidateName?: string
  candidateCurrentCompany?: string
  candidateCurrentTitle?: string
  candidateLocation?: string
  companyName?: string
  tone?: 'professional' | 'casual' | 'friendly' | 'formal'
  customInstructions?: string
}

interface GenerateEmailResult {
  subject: string
  body: string
}

interface UseGenerateEmailReturn {
  generateEmail: (input: GenerateEmailInput) => Promise<GenerateEmailResult | null>
  loading: boolean
  error: string | null
}

export function useGenerateEmail(): UseGenerateEmailReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateEmail = useCallback(async (input: GenerateEmailInput): Promise<GenerateEmailResult | null> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to generate email')
        return null
      }

      const data = await response.json()
      return { subject: data.subject, body: data.body }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate email')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { generateEmail, loading, error }
}
