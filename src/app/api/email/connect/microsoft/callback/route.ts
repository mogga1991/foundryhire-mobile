import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emailAccounts, emailAccountSecrets } from '@/lib/db/schema'
import { encrypt } from '@/lib/utils/encryption'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/settings/email?error=oauth_denied`)
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common'

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/settings/email?error=not_configured`)
  }

  const redirectUri = `${appUrl}/api/email/connect/microsoft/callback`

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          scope: 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access',
        }),
      }
    )

    if (!tokenResponse.ok) {
      console.error('[Microsoft OAuth] Token exchange failed:', await tokenResponse.text())
      return NextResponse.redirect(`${appUrl}/settings/email?error=token_exchange_failed`)
    }

    const tokens = await tokenResponse.json()

    // Get user profile
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!profileResponse.ok) {
      return NextResponse.redirect(`${appUrl}/settings/email?error=profile_failed`)
    }

    const profile = await profileResponse.json()
    const emailAddress = profile.mail || profile.userPrincipalName

    if (!emailAddress) {
      return NextResponse.redirect(`${appUrl}/settings/email?error=no_email`)
    }

    const { requireCompanyAccess } = await import('@/lib/auth-helpers')
    const { companyId } = await requireCompanyAccess()

    // Create email account
    const [account] = await db
      .insert(emailAccounts)
      .values({
        companyId,
        type: 'microsoft_oauth',
        displayName: profile.displayName || emailAddress,
        fromAddress: emailAddress,
        fromName: profile.displayName || null,
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

    return NextResponse.redirect(`${appUrl}/settings/email?connected=microsoft`)
  } catch (err) {
    console.error('[Microsoft OAuth] Callback error:', err)
    return NextResponse.redirect(`${appUrl}/settings/email?error=callback_failed`)
  }
}
