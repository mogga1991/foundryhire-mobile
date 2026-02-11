// Sentry server-side configuration
// This file is loaded by @sentry/nextjs automatically
// Note: @sentry/nextjs must be installed for this to take effect

// Only initialize Sentry if DSN is configured
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  import('@sentry/nextjs')
    .then((Sentry) => {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        tracesSampleRate: 0.1, // 10% of transactions
        environment: process.env.NODE_ENV,
      })
    })
    .catch(() => {
      // Sentry not installed - monitoring disabled
    })
}
