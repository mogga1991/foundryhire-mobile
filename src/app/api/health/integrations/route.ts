import { NextRequest, NextResponse } from 'next/server'
import { FEATURES, env } from '@/lib/env'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:health:integrations')

/**
 * GET /api/health/integrations
 *
 * Returns the status of all integrations based on configuration.
 * No authentication required - this is for monitoring purposes.
 * Rate limited to 30 requests per minute.
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimit(request, {
      limit: 30,
      window: 60 * 1000, // 1 minute
    })

    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // Check database connectivity
    let dbStatus: 'connected' | 'disconnected' = 'disconnected'
    try {
      // Simple query to test database connection
      await db.execute('SELECT 1')
      dbStatus = 'connected'
    } catch (error) {
      logger.error({ message: 'Database health check failed', error })
      dbStatus = 'disconnected'
    }

    // Build integration status
    const integrations = {
      auth: {
        configured: !!(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        services: {
          supabaseUrl: !!env.NEXT_PUBLIC_SUPABASE_URL,
          supabaseAnonKey: !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          supabaseServiceRole: !!env.SUPABASE_SERVICE_ROLE_KEY,
          appUrl: !!env.NEXT_PUBLIC_APP_URL,
        },
      },
      zoom: {
        configured: FEATURES.zoom,
        services: {
          meetings: !!(env.ZOOM_ACCOUNT_ID && env.ZOOM_CLIENT_ID),
          sdk: !!env.ZOOM_SDK_KEY,
          webhooks: !!env.ZOOM_WEBHOOK_SECRET,
        },
      },
      deepgram: {
        configured: FEATURES.deepgram,
      },
      email: {
        configured: FEATURES.email,
        services: {
          sending: !!env.RESEND_API_KEY,
          webhooks: !!env.RESEND_WEBHOOK_SECRET,
        },
      },
      ai: {
        configured: FEATURES.ai,
        providers: {
          anthropic: !!env.ANTHROPIC_API_KEY,
          mistral: !!env.MISTRAL_API_KEY,
          openai: !!env.OPENAI_API_KEY,
        },
      },
      enrichment: {
        configured: FEATURES.enrichment,
        providers: {
          lusha: !!env.LUSHA_API_KEY,
          apollo: !!env.APOLLO_API_KEY,
          proxycurl: !!env.PROXYCURL_API_KEY,
          coresignal: !!env.CORESIGNAL_API_KEY,
        },
      },
      payments: {
        configured: FEATURES.payments,
        services: {
          checkout: !!env.STRIPE_SECRET_KEY,
          webhooks: !!env.STRIPE_WEBHOOK_SECRET,
        },
      },
      monitoring: {
        configured: FEATURES.monitoring,
      },
    }

    // Calculate overall health
    const requiredIntegrations = ['email', 'ai'] as const
    const allRequiredConfigured = requiredIntegrations.every(
      (key) => integrations[key].configured
    )

    const status =
      dbStatus === 'connected' && allRequiredConfigured ? 'healthy' : 'degraded'

    logger.info({
      message: 'Health check performed',
      status,
      dbStatus,
      integrationsConfigured: Object.entries(integrations)
        .filter(([, config]) => config.configured)
        .map(([name]) => name),
    })

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      database: dbStatus,
      integrations,
    })
  } catch (error) {
    logger.error({ message: 'Health check error', error })

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
