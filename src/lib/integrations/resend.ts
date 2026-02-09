import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY

const resend = resendApiKey ? new Resend(resendApiKey) : null

// Format: "Name <email@domain.com>"
const fromName = process.env.EMAIL_FROM_NAME ?? 'VerticalHire'
const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@verticalhire.com'
const DEFAULT_FROM = `${fromName} <${fromEmail}>`

interface SendEmailParams {
  to: string
  subject: string
  body: string
  from?: string
}

interface SendEmailResult {
  success: boolean
  id: string | null
  error: string | null
}

/**
 * Send a single email via Resend.
 * For MVP: if Resend is not configured, logs the email and returns a mock success.
 */
export async function sendEmail({
  to,
  subject,
  body,
  from,
}: SendEmailParams): Promise<SendEmailResult> {
  if (!resend) {
    console.log('[MVP Email] Sending email (mock):')
    console.log(`  To: ${to}`)
    console.log(`  From: ${from ?? DEFAULT_FROM}`)
    console.log(`  Subject: ${subject}`)
    console.log(`  Body length: ${body.length} chars`)
    return {
      success: true,
      id: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      error: null,
    }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: from ?? DEFAULT_FROM,
      to,
      subject,
      html: body,
    })

    if (error) {
      console.error('[Resend] Error sending email:', error)
      return { success: false, id: null, error: error.message }
    }

    return { success: true, id: data?.id ?? null, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error sending email'
    console.error('[Resend] Exception:', message)
    return { success: false, id: null, error: message }
  }
}

interface BulkEmailItem {
  to: string
  subject: string
  body: string
  from?: string
}

interface BulkSendResult {
  total: number
  succeeded: number
  failed: number
  results: SendEmailResult[]
}

/**
 * Send multiple emails via Resend.
 * For MVP: if Resend is not configured, logs all emails and returns mock successes.
 */
export async function sendBulkEmails(
  emails: BulkEmailItem[]
): Promise<BulkSendResult> {
  if (!resend) {
    console.log(`[MVP Email] Sending ${emails.length} emails (mock):`)
    const results: SendEmailResult[] = emails.map((email, index) => {
      console.log(`  [${index + 1}] To: ${email.to} | Subject: ${email.subject}`)
      return {
        success: true,
        id: `mock_bulk_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 9)}`,
        error: null,
      }
    })
    return {
      total: emails.length,
      succeeded: emails.length,
      failed: 0,
      results,
    }
  }

  const results: SendEmailResult[] = []
  let succeeded = 0
  let failed = 0

  for (const email of emails) {
    const result = await sendEmail({
      to: email.to,
      subject: email.subject,
      body: email.body,
      from: email.from,
    })
    results.push(result)
    if (result.success) {
      succeeded++
    } else {
      failed++
    }
  }

  return {
    total: emails.length,
    succeeded,
    failed,
    results,
  }
}
