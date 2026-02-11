import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emailAccounts, emailAccountSecrets } from '@/lib/db/schema'
import { encrypt } from '@/lib/utils/encryption'
import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:email:connect:gmail:callback')

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')

  const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/settings/email?error=oauth_denied`)
  }

  const clientId = env.GOOGLE_CLIENT_ID
  const clientSecret = env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/settings/email?error=not_configured`)
  }

  const redirectUri = `${appUrl}/api/email/connect/gmail/callback`

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      logger.error({ message: 'Token exchange failed', responseText: await tokenResponse.text() })
      return NextResponse.redirect(`${appUrl}/settings/email?error=token_exchange_failed`)
    }

    const tokens = await tokenResponse.json()

    // Get user's email address
    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    )

    if (!userInfoResponse.ok) {
      return NextResponse.redirect(`${appUrl}/settings/email?error=userinfo_failed`)
    }

    const userInfo = await userInfoResponse.json()
    const emailAddress = userInfo.email

    if (!emailAddress) {
      return NextResponse.redirect(`${appUrl}/settings/email?error=no_email`)
    }

    // We need to get the companyId from a session cookie
    // Since this is a callback (public route), read session from cookie
    const { requireCompanyAccess } = await import('@/lib/auth-helpers')
    const { companyId } = await requireCompanyAccess()

    // Create email account
    const [account] = await db
      .insert(emailAccounts)
      .values({
        companyId,
        type: 'gmail_oauth',
        displayName: userInfo.name || emailAddress,
        fromAddress: emailAddress,
        fromName: userInfo.name || null,
        status: 'active',
        capabilities: {
          supportsInbound: true,
          supportsWebhooks: false,
          supportsThreading: true,
        },
      })
      .returning()

    // Store encrypted tokens
    const encryptedData = encrypt(
      JSON.stringify({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      })
    )

    await db.insert(emailAccountSecrets).values({
      emailAccountId: account.id,
      encryptedData,
    })

    return NextResponse.redirect(`${appUrl}/settings/email?connected=gmail`)
  } catch (err) {
    logger.error({ message: 'Gmail OAuth callback error', error: err })
    return NextResponse.redirect(`${appUrl}/settings/email?error=callback_failed`)
  }
}
