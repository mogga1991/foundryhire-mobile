import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { syncSupabaseUser } from '@/lib/auth'

const logger = createLogger('api:auth:callback')

function getSafeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/')) {
    return '/dashboard'
  }

  if (value.startsWith('//')) {
    return '/dashboard'
  }

  return value
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const nextPath = getSafeNextPath(requestUrl.searchParams.get('next'))
  const code = requestUrl.searchParams.get('code')
  const providerError = requestUrl.searchParams.get('error_description')

  if (providerError) {
    return NextResponse.redirect(new URL('/login?error=oauth_denied', request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=oauth_code_missing', request.url))
  }

  try {
    const supabase = await createSupabaseServerClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      logger.error({ exchangeError }, 'Failed to exchange OAuth code for session')
      return NextResponse.redirect(new URL('/login?error=oauth_exchange_failed', request.url))
    }

    const {
      data: { user: authUser },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !authUser) {
      logger.error({ userError }, 'OAuth callback did not return a user')
      return NextResponse.redirect(new URL('/login?error=oauth_user_missing', request.url))
    }

    const syncedUser = await syncSupabaseUser(authUser)

    if (syncedUser.error) {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login?error=legacy_conflict', request.url))
    }

    return NextResponse.redirect(new URL(nextPath, request.url))
  } catch (error) {
    logger.error({ error }, 'OAuth callback failed')
    return NextResponse.redirect(new URL('/login?error=oauth_callback_failed', request.url))
  }
}
