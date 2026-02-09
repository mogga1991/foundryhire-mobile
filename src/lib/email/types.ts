export type EmailProviderType = 'esp' | 'gmail_oauth' | 'microsoft_oauth' | 'smtp'

export interface EmailMessage {
  from: string
  fromName?: string
  to: string
  subject: string
  html: string
  text?: string
  headers?: Record<string, string>
  replyTo?: string
  campaignSendId?: string
}

export interface EmailSendResult {
  providerMessageId: string
  acceptedAt: Date
}

export interface EmailProvider {
  type: EmailProviderType
  send(message: EmailMessage): Promise<EmailSendResult>
  supportsInbound: boolean
  supportsWebhooks: boolean
  supportsThreading: boolean
}
