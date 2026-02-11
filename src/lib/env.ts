import { z } from 'zod'

/**
 * Environment variable validation schema
 * Only DATABASE_URL and JWT_SECRET are strictly required for the app to start.
 * Other variables are optional and enable specific features when provided.
 */
const serverEnvSchema = z.object({
  // =============================================================================
  // REQUIRED - App cannot start without these
  // =============================================================================
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .url('DATABASE_URL must be a valid URL'),
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 characters for security'),

  // =============================================================================
  // Core Settings - Optional with defaults
  // =============================================================================
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // =============================================================================
  // Email Infrastructure - Optional
  // =============================================================================
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  EMAIL_FROM_NAME: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),

  // Email Campaigns - Optional
  ENCRYPTION_KEY: z.string().length(64).optional(), // 32 bytes = 64 hex chars
  CRON_SECRET: z.string().optional(),

  // OAuth for Email Connections - Optional
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().optional(),

  // =============================================================================
  // Zoom Integration - Optional
  // =============================================================================
  ZOOM_ACCOUNT_ID: z.string().optional(),
  ZOOM_CLIENT_ID: z.string().optional(),
  ZOOM_CLIENT_SECRET: z.string().optional(),
  ZOOM_SDK_KEY: z.string().optional(),
  ZOOM_SDK_SECRET: z.string().optional(),
  ZOOM_WEBHOOK_SECRET: z.string().optional(),

  // =============================================================================
  // AI Services - Optional
  // =============================================================================
  ANTHROPIC_API_KEY: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  DEEPGRAM_API_KEY: z.string().optional(),

  // =============================================================================
  // Lead Generation & Enrichment APIs - Optional
  // =============================================================================
  APOLLO_API_KEY: z.string().optional(),
  CORESIGNAL_API_KEY: z.string().optional(),
  PROXYCURL_API_KEY: z.string().optional(),
  LUSHA_API_KEY: z.string().optional(),

  // =============================================================================
  // Optional Sourcing APIs - Optional
  // =============================================================================
  APIFY_API_TOKEN: z.string().optional(),
  PHANTOMBUSTER_API_KEY: z.string().optional(),
  PHANTOMBUSTER_LINKEDIN_AGENT_ID: z.string().optional(),

  // =============================================================================
  // Email Finding & Verification - Optional
  // =============================================================================
  HUNTER_API_KEY: z.string().optional(),
  ZEROBOUNCE_API_KEY: z.string().optional(),
  SNOVIO_API_KEY: z.string().optional(),
  SNOVIO_CLIENT_ID: z.string().optional(),
  SNOVIO_CLIENT_SECRET: z.string().optional(),

  // =============================================================================
  // Phone Verification - Optional
  // =============================================================================
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),

  // =============================================================================
  // Data Enrichment - Optional
  // =============================================================================
  CLEARBIT_API_KEY: z.string().optional(),
  PEOPLE_DATA_LABS_API_KEY: z.string().optional(),

  // =============================================================================
  // Stripe Payments - Optional
  // =============================================================================
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // =============================================================================
  // Google Cloud / Vertex AI - Optional
  // =============================================================================
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
  GOOGLE_CLOUD_LOCATION: z.string().optional(),

  // =============================================================================
  // Logging - Optional
  // =============================================================================
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .optional(),

  // =============================================================================
  // Rate Limiting - Optional
  // =============================================================================
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // =============================================================================
  // Monitoring & Error Tracking - Optional
  // =============================================================================
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  // =============================================================================
  // Admin & Security - Optional
  // =============================================================================
  ADMIN_MIGRATION_TOKEN: z.string().optional(),
})

/**
 * Validates environment variables and throws if required variables are missing.
 * Optional variables that are missing will only generate warnings in development.
 */
function validateEnv() {
  const result = serverEnvSchema.safeParse(process.env)

  if (!result.success) {
    console.error('❌ Invalid environment variables:')
    result.error.issues.forEach((issue) => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    })
    console.error(
      '\n💡 See .env.example for required values and configuration details.'
    )
    throw new Error(
      'Environment validation failed. Fix the errors above and restart.'
    )
  }

  return result.data
}

/**
 * Validated and type-safe environment variables.
 * Use this throughout the app instead of process.env for type safety.
 *
 * @example
 * import { env } from '@/lib/env'
 * const dbUrl = env.DATABASE_URL // type-safe and validated
 */
export const env = validateEnv()

/**
 * Feature flags based on configured environment variables.
 * Use these to check if integrations are available at runtime.
 *
 * @example
 * import { FEATURES } from '@/lib/env'
 * if (FEATURES.zoom) {
 *   // Zoom integration is configured
 * }
 */
export const FEATURES = {
  zoom: !!(env.ZOOM_ACCOUNT_ID && env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET),
  deepgram: !!env.DEEPGRAM_API_KEY,
  email: !!env.RESEND_API_KEY,
  ai: !!env.ANTHROPIC_API_KEY,
  enrichment: !!(env.LUSHA_API_KEY || env.APOLLO_API_KEY || env.PROXYCURL_API_KEY),
  payments: !!env.STRIPE_SECRET_KEY,
  monitoring: !!env.NEXT_PUBLIC_SENTRY_DSN,
} as const
