'use client'

import { useState, useEffect } from 'react'

interface UseUserReturn {
  user: { id: string; email: string; name: string; image?: string | null } | null
  loading: boolean
  error: string | null
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<UseUserReturn['user']>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/session')
        if (res.ok) {
          const data = await res.json()
          setUser(data.user)
        } else {
          setUser(null)
        }
      } catch (err) {
        console.error('Failed to fetch session:', err)
        setError('Failed to fetch user session')
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
  }, [])

  return { user, loading, error }
}
