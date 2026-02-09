'use client'

import { useState, useEffect, useCallback } from 'react'

interface EmailAccount {
  id: string
  companyId: string
  type: 'esp' | 'gmail_oauth' | 'microsoft_oauth' | 'smtp'
  fromAddress: string
  fromName: string | null
  isDefault: boolean
  status: string
  createdAt: string
  updatedAt: string
}

export interface DomainIdentity {
  id: string
  companyId: string
  domain: string
  dkimStatus: string
  spfStatus: string
  dkimRecords: Record<string, unknown>[] | null
  spfRecord: string | null
  resendDomainId: string | null
  verifiedAt: string | null
  createdAt: string
  updatedAt: string
}

export function useEmailAccounts() {
  const [data, setData] = useState<EmailAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/email/accounts')
      if (!res.ok) throw new Error('Failed to fetch email accounts')
      const json = await res.json()
      setData(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  return { data, loading, error, refetch: fetchAccounts }
}

export function useDomainIdentities() {
  const [data, setData] = useState<DomainIdentity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDomains = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/email/domains')
      if (!res.ok) throw new Error('Failed to fetch domains')
      const json = await res.json()
      setData(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDomains()
  }, [fetchDomains])

  return { data, loading, error, refetch: fetchDomains }
}
