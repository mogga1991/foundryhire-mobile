import { Resend } from 'resend'
import { env } from '@/lib/env'
import type { EmailProvider, EmailMessage, EmailSendResult } from '../types'

export class ResendProvider implements EmailProvider {
  type = 'esp' as const
  supportsInbound = false
  supportsWebhooks = true
  supportsThreading = false

  private client: Resend

  constructor(apiKey?: string) {
    const key = apiKey || env.RESEND_API_KEY
    if (!key) throw new Error('Resend API key required')
    this.client = new Resend(key)
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const from = message.fromName
      ? `${message.fromName} <${message.from}>`
      : message.from

    const { data, error } = await this.client.emails.send({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
      headers: message.headers,
    })

    if (error) throw new Error(error.message)
    return {
      providerMessageId: data?.id ?? '',
      acceptedAt: new Date(),
    }
  }

  async createDomain(domain: string) {
    const { data, error } = await this.client.domains.create({ name: domain })
    if (error) throw new Error(error.message)
    return data
  }

  async verifyDomain(domainId: string) {
    const { data, error } = await this.client.domains.verify(domainId)
    if (error) throw new Error(error.message)
    return data
  }

  async getDomain(domainId: string) {
    const { data, error } = await this.client.domains.get(domainId)
    if (error) throw new Error(error.message)
    return data
  }

  async deleteDomain(domainId: string) {
    const { data, error } = await this.client.domains.remove(domainId)
    if (error) throw new Error(error.message)
    return data
  }
}
