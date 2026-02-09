import type { EmailProvider, EmailMessage, EmailSendResult } from '../types'

interface MicrosoftProviderConfig {
  accessToken: string
  refreshToken: string
  expiresAt: number
  onTokenRefresh: (tokens: { accessToken: string; expiresAt: number }) => Promise<void>
}

export class MicrosoftProvider implements EmailProvider {
  type = 'microsoft_oauth' as const
  supportsInbound = true
  supportsWebhooks = false
  supportsThreading = true

  private accessToken: string
  private refreshToken: string
  private expiresAt: number
  private onTokenRefresh: MicrosoftProviderConfig['onTokenRefresh']

  constructor(config: MicrosoftProviderConfig) {
    this.accessToken = config.accessToken
    this.refreshToken = config.refreshToken
    this.expiresAt = config.expiresAt
    this.onTokenRefresh = config.onTokenRefresh
  }

  private async ensureValidToken(): Promise<string> {
    if (Date.now() < this.expiresAt - 60_000) {
      return this.accessToken
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
    const tenantId = process.env.MICROSOFT_TENANT_ID || 'common'

    if (!clientId || !clientSecret) {
      throw new Error('Microsoft OAuth credentials not configured')
    }

    const response = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
          scope: 'https://graph.microsoft.com/Mail.Send offline_access',
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Failed to refresh Microsoft token: ${err}`)
    }

    const data = await response.json()
    this.accessToken = data.access_token
    this.expiresAt = Date.now() + data.expires_in * 1000

    await this.onTokenRefresh({
      accessToken: this.accessToken,
      expiresAt: this.expiresAt,
    })

    return this.accessToken
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const token = await this.ensureValidToken()

    const from = message.from
    const mailBody: Record<string, unknown> = {
      message: {
        subject: message.subject,
        body: {
          contentType: 'HTML',
          content: message.html,
        },
        from: {
          emailAddress: {
            address: from,
            name: message.fromName || undefined,
          },
        },
        toRecipients: [
          {
            emailAddress: { address: message.to },
          },
        ],
        internetMessageHeaders: Object.entries(message.headers || {}).map(
          ([name, value]) => ({ name, value })
        ),
      },
      saveToSentItems: true,
    }

    if (message.replyTo) {
      (mailBody.message as Record<string, unknown>).replyTo = [
        { emailAddress: { address: message.replyTo } },
      ]
    }

    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me/sendMail',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mailBody),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Microsoft Graph send failed: ${err}`)
    }

    // Microsoft sendMail returns 202 Accepted with no body
    return {
      providerMessageId: `ms_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      acceptedAt: new Date(),
    }
  }
}
