'use client'

import { useCallback, useState } from 'react'
import type { ParseJobDescriptionResult } from '@/lib/ai/prompts/parse-job-description'

interface UseParseJobReturn {
  parseJob: (text: string, documentUrl?: string) => Promise<ParseJobDescriptionResult | null>
  parsing: boolean
  error: string | null
}

export function useParseJob(): UseParseJobReturn {
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parseJob = useCallback(async (text: string, documentUrl?: string) => {
    setParsing(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/parse-job-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, documentUrl }),
      })

      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Failed to parse job description')
        return null
      }

      return data.data
    } catch (err) {
      setError('An error occurred while parsing')
      return null
    } finally {
      setParsing(false)
    }
  }, [])

  return { parseJob, parsing, error }
}
