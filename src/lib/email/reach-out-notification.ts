import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'

const logger = createLogger('email:reach-out-notification')

interface ReachOutNotificationParams {
  candidateEmail: string
  candidateName: string
  employerName: string
  companyName: string
  message: string
  portalUrl: string
}

export async function sendReachOutNotification(params: ReachOutNotificationParams): Promise<void> {
  const {
    candidateEmail,
    candidateName,
    employerName,
    companyName,
    message,
    portalUrl,
  } = params

  const subject = `${employerName} from ${companyName} is interested in you`

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">You Have a New Opportunity</h1>
  </div>

  <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Hi ${candidateName},</p>

    <p>Great news! <strong>${employerName}</strong> from <strong>${companyName}</strong> is interested in connecting with you.</p>

    <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #065f46;">Their message:</p>
      <p style="margin: 0; color: #047857; white-space: pre-wrap;">${message}</p>
    </div>

    <p>This could be the opportunity you've been waiting for. Take a moment to review their message and respond through your candidate portal.</p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: #10b981; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
        View Message & Respond
      </a>
    </div>

    <p style="font-size: 14px; color: #64748b;">
      Respond promptly to make a great impression and keep the conversation going.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
      This message was sent via VerticalHire. To manage your notification preferences, visit your portal settings.
    </p>
  </div>
</body>
</html>`

  const textBody = `Hi ${candidateName},

Great news! ${employerName} from ${companyName} is interested in connecting with you.

Their message:
"${message}"

This could be the opportunity you've been waiting for. Take a moment to review their message and respond through your candidate portal.

View Message & Respond: ${portalUrl}

Respond promptly to make a great impression and keep the conversation going.

---
This message was sent via VerticalHire. To manage your notification preferences, visit your portal settings.`

  // Use Resend if available, otherwise log
  if (env.RESEND_API_KEY) {
    const { Resend } = await import('resend')
    const resend = new Resend(env.RESEND_API_KEY)

    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL || 'opportunities@verticalhire.com',
      to: candidateEmail,
      subject,
      html: htmlBody,
      text: textBody,
    })
  } else {
    logger.info({
      message: 'Would send reach-out notification (no RESEND_API_KEY)',
      candidateEmail,
      subject,
      employerName,
      companyName,
    })
  }
}
