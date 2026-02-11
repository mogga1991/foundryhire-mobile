'use client'

import { useEffect } from 'react'

/**
 * Portal-specific error boundary.
 * Captures unhandled errors in the candidate portal section.
 */
export default function PortalError({
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
          component: 'PortalError',
          action: 'unhandled_error',
          metadata: { digest: error.digest },
        })
      })
      .catch(() => {
        console.error('[Portal Error]', error.message, error.digest)
      })
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-center p-8">
      <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground mb-4 max-w-md">
        We encountered an issue loading this page. Please try again or contact support if the problem persists.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground mb-4">
          Error ID: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="px-5 py-2.5 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors"
      >
        Try Again
      </button>
    </div>
  )
}
