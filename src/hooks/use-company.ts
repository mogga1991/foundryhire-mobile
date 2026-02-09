'use client'

import { useState, useEffect } from 'react'
import type { Company } from '@/lib/types'

interface CompanyWithRole extends Company {
  user_role: string
}

interface UseCompanyReturn {
  company: CompanyWithRole | null
  loading: boolean
  error: string | null
}

export function useCompany(): UseCompanyReturn {
  const [company, setCompany] = useState<CompanyWithRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCompany() {
      try {
        const res = await fetch('/api/company')
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Failed to fetch company')
          setLoading(false)
          return
        }

        const data = await res.json()
        setCompany(data.company)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch company'
        )
      } finally {
        setLoading(false)
      }
    }

    fetchCompany()
  }, [])

  return { company, loading, error }
}
