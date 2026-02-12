/**
 * API Route: Search Supabase Lead Pool
 *
 * POST /api/leads/pool/search
 *
 * Body (JSON):
 * - query: string (required)
 * - jobId: string (optional UUID)
 * - limit: number (optional, default 25, max 100)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const logger = createLogger('api:leads:pool:search')

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

async function _POST(request: NextRequest) {
  try {
    const { companyId } = await requireCompanyAccess()
    const body = await request.json().catch(() => null) as null | { query?: unknown; jobId?: unknown; limit?: unknown }

    const query = typeof body?.query === 'string' ? body.query.trim() : ''
    const jobIdRaw = typeof body?.jobId === 'string' ? body.jobId.trim() : ''
    const jobId = jobIdRaw ? (isUuid(jobIdRaw) ? jobIdRaw : null) : null
    const limitRaw = typeof body?.limit === 'number' ? body.limit : 25
    const limit = Math.max(1, Math.min(100, Math.floor(limitRaw)))

    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }
    if (jobIdRaw && !jobId) {
      return NextResponse.json({ error: 'Invalid jobId (expected UUID)' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()

    const { data, error } = await supabase.rpc('search_leads', {
      p_company_id: companyId,
      p_query: query,
      p_job_id: jobId,
      p_limit: limit,
    })

    if (error) {
      logger.error({ message: 'Lead pool search failed', companyId, error })
      return NextResponse.json({ error: 'Lead pool search failed', message: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, results: data || [] })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json(
        { error: 'No company set up. Please create your company in Settings first.' },
        { status: 400 }
      )
    }
    logger.error({ message: 'Lead pool search error', error })
    return NextResponse.json(
      { error: 'Lead pool search failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })

