import type { EmailProvider, EmailMessage, EmailSendResult } from '../types'
import nodemailer from 'nodemailer'

interface SmtpProviderConfig {
  host: string
  port: number
  username: string
  password: string
  useTls?: boolean
}

export class SmtpProvider implements EmailProvider {
  type = 'smtp' as const
  supportsInbound = false
  supportsWebhooks = false
  supportsThreading = false

  private config: SmtpProviderConfig

  constructor(config: SmtpProviderConfig) {
    this.config = config
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.useTls ?? true,
      auth: {
        user: this.config.username,
        pass: this.config.password,
      },
    })

    const from = message.fromName
      ? `${message.fromName} <${message.from}>`
      : message.from

    const info = await transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
      headers: message.headers,
    })

    return {
      providerMessageId: info.messageId || `smtp_${Date.now()}`,
      acceptedAt: new Date(),
    }
  }
}
