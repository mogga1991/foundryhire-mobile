'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Report to Sentry via dynamic import (graceful degradation)
    import('@/lib/monitoring/sentry')
      .then(({ captureError }) => {
        captureError(error, {
          component: 'DashboardError',
          action: 'unhandled_error',
          metadata: { digest: error.digest },
        })
      })
      .catch(() => {
        console.error('[Dashboard Error]', error.message, error.digest)
      })
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-center p-8">
      <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground mb-4 max-w-md">
        {error.message || 'An unexpected error occurred'}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground mb-4">
          Error ID: {error.digest}
        </p>
      )}
      <Button onClick={reset}>Try Again</Button>
    </div>
  )
}
