import { NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { env } from '@/lib/env'
import crypto from 'crypto'

export async function GET() {
  try {
    await requireCompanyAccess()

    const clientId = env.MICROSOFT_CLIENT_ID
    const tenantId = env.MICROSOFT_TENANT_ID || 'common'

    if (!clientId) {
      return NextResponse.json({ error: 'Microsoft OAuth not configured' }, { status: 500 })
    }

    const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/email/connect/microsoft/callback`
    const state = crypto.randomBytes(16).toString('hex')

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access',
      state,
      response_mode: 'query',
    })

    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`

    return NextResponse.json({ url, state })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
