import type { EmailProvider, EmailMessage, EmailSendResult } from '../types'

interface GmailProviderConfig {
  accessToken: string
  refreshToken: string
  expiresAt: number
  onTokenRefresh: (tokens: { accessToken: string; expiresAt: number }) => Promise<void>
}

export class GmailProvider implements EmailProvider {
  type = 'gmail_oauth' as const
  supportsInbound = true
  supportsWebhooks = false
  supportsThreading = true

  private accessToken: string
  private refreshToken: string
  private expiresAt: number
  private onTokenRefresh: GmailProviderConfig['onTokenRefresh']

  constructor(config: GmailProviderConfig) {
    this.accessToken = config.accessToken
    this.refreshToken = config.refreshToken
    this.expiresAt = config.expiresAt
    this.onTokenRefresh = config.onTokenRefresh
  }

  private async ensureValidToken(): Promise<string> {
    if (Date.now() < this.expiresAt - 60_000) {
      return this.accessToken
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured')
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Failed to refresh Gmail token: ${err}`)
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

  private buildRawEmail(message: EmailMessage): string {
    const boundary = `boundary_${Date.now()}`
    const from = message.fromName
      ? `${message.fromName} <${message.from}>`
      : message.from

    const headers = [
      `From: ${from}`,
      `To: ${message.to}`,
      `Subject: ${message.subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ]

    if (message.replyTo) {
      headers.push(`Reply-To: ${message.replyTo}`)
    }

    if (message.headers) {
      for (const [key, value] of Object.entries(message.headers)) {
        headers.push(`${key}: ${value}`)
      }
    }

    const parts = []

    if (message.text) {
      parts.push(
        `--${boundary}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${message.text}`
      )
    }

    parts.push(
      `--${boundary}\r\nContent-Type: text/html; charset="UTF-8"\r\n\r\n${message.html}`
    )

    const rawEmail = `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}\r\n--${boundary}--`

    return Buffer.from(rawEmail)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const token = await this.ensureValidToken()
    const raw = this.buildRawEmail(message)

    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Gmail send failed: ${err}`)
    }

    const data = await response.json()

    return {
      providerMessageId: data.id,
      acceptedAt: new Date(),
    }
  }
}
