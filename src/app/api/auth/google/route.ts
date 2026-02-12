import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const logger = createLogger('api:auth:google')

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
  try {
    const nextPath = getSafeNextPath(request.nextUrl.searchParams.get('next'))
    const callbackUrl = new URL('/api/auth/callback', request.url)
    callbackUrl.searchParams.set('next', nextPath)

    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })

    if (error || !data.url) {
      logger.error({ error }, 'Failed to create Google auth URL')
      return NextResponse.redirect(new URL('/login?error=google_auth_failed', request.url))
    }

    return NextResponse.redirect(data.url)
  } catch (error) {
    logger.error({ error }, 'Google sign-in initiation failed')
    if (error instanceof Error && error.message.includes('Supabase environment is not configured')) {
      return NextResponse.redirect(new URL('/login?error=auth_not_configured', request.url))
    }
    return NextResponse.redirect(new URL('/login?error=google_auth_failed', request.url))
  }
}
