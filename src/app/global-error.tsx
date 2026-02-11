'use client'

import { useEffect } from 'react'

/**
 * Global error boundary for the entire application.
 * Captures unhandled errors and reports to Sentry (if available).
 * This is the last-resort error boundary in Next.js App Router.
 */
export default function GlobalError({
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
          component: 'GlobalError',
          action: 'unhandled_error',
          metadata: { digest: error.digest },
        })
      })
      .catch(() => {
        // Monitoring module not available; log to console as fallback
        console.error('[GlobalError]', error.message, error.digest)
      })
  }, [error])

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textAlign: 'center',
            backgroundColor: '#fafafa',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              padding: '2rem',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#111' }}>
              Something went wrong
            </h1>
            <p style={{ color: '#666', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              An unexpected error occurred. Our team has been notified and is working to fix the issue.
            </p>
            {error.digest && (
              <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '1rem' }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                padding: '0.625rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#fff',
                backgroundColor: '#111',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
