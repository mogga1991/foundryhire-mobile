import { z } from 'zod'

/**
 * Environment variable validation schema
 * Variables are validated lazily at runtime.
 * Optional values treat empty strings as "not set" to avoid failing on blank env entries.
 */
const serverEnvSchema = z.object({
  // =============================================================================
  // Core runtime
  // =============================================================================
  DATABASE_URL: z
    .string()
    .url('DATABASE_URL must be a valid URL')
    .optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters for security').optional(),

  // =============================================================================
  // Core Settings - Optional with defaults
  // =============================================================================
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // =============================================================================
  // Email Infrastructure - Optional
  // =============================================================================
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  EMAIL_FROM_NAME: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),

  // Email Campaigns - Optional
  ENCRYPTION_KEY: z.string().min(16).max(128).optional(), // hex-encoded encryption key
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

type EnvType = z.infer<typeof serverEnvSchema>

let _cachedEnv: EnvType | null = null

/**
 * Validates environment variables and throws if required variables are missing.
 * Only runs at runtime (not during build) via lazy initialization.
 */
function getValidatedEnv(): EnvType {
  if (_cachedEnv) return _cachedEnv

  // Skip validation during build phase — env vars aren't available yet
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return process.env as unknown as EnvType
  }

  // Normalize blank env values to undefined so optional vars don't fail validation
  const normalizedEnv = Object.fromEntries(
    Object.entries(process.env).map(([key, value]) => [
      key,
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    ])
  )

  const result = serverEnvSchema.safeParse(normalizedEnv)

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

  _cachedEnv = result.data
  return _cachedEnv
}

/**
 * Validated and type-safe environment variables.
 * Uses a lazy proxy so validation only runs at runtime, not during build.
 *
 * @example
 * import { env } from '@/lib/env'
 * const dbUrl = env.DATABASE_URL // type-safe and validated
 */
export const env: EnvType = new Proxy({} as EnvType, {
  get(_target, prop: string) {
    const validated = getValidatedEnv()
    return validated[prop as keyof EnvType]
  },
})

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
export const FEATURES = new Proxy(
  {} as {
    readonly zoom: boolean
    readonly deepgram: boolean
    readonly email: boolean
    readonly ai: boolean
    readonly enrichment: boolean
    readonly payments: boolean
    readonly monitoring: boolean
  },
  {
    get(_target, prop: string) {
      const e = getValidatedEnv()
      switch (prop) {
        case 'zoom':
          return !!(e.ZOOM_ACCOUNT_ID && e.ZOOM_CLIENT_ID && e.ZOOM_CLIENT_SECRET)
        case 'deepgram':
          return !!e.DEEPGRAM_API_KEY
        case 'email':
          return !!e.RESEND_API_KEY
        case 'ai':
          return !!e.ANTHROPIC_API_KEY
        case 'enrichment':
          return !!(e.LUSHA_API_KEY || e.APOLLO_API_KEY || e.PROXYCURL_API_KEY)
        case 'payments':
          return !!e.STRIPE_SECRET_KEY
        case 'monitoring':
          return !!e.NEXT_PUBLIC_SENTRY_DSN
        default:
          return undefined
      }
    },
  }
)
