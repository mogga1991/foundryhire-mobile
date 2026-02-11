import { NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { env } from '@/lib/env'
import crypto from 'crypto'

export async function GET() {
  try {
    await requireCompanyAccess()

    const clientId = env.GOOGLE_CLIENT_ID
    if (!clientId) {
      return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 })
    }

    const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/email/connect/gmail/callback`
    const state = crypto.randomBytes(16).toString('hex')

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    })

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    return NextResponse.json({ url, state })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
