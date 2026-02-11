import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'

const logger = createLogger('email:message-notification')

interface MessageNotificationParams {
  candidateEmail: string
  candidateName: string
  senderName: string
  companyName: string
  messagePreview: string
  portalUrl: string
}

export async function sendMessageNotification(params: MessageNotificationParams): Promise<void> {
  const {
    candidateEmail,
    candidateName,
    senderName,
    companyName,
    messagePreview,
    portalUrl,
  } = params

  const subject = `New message from ${senderName} at ${companyName}`

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">New Message</h1>
  </div>

  <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Hi ${candidateName},</p>

    <p>You have a new message from <strong>${senderName}</strong> at <strong>${companyName}</strong>:</p>

    <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0; color: #475569; font-style: italic;">${messagePreview}</p>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        View and Reply
      </a>
    </div>

    <p style="font-size: 14px; color: #64748b;">
      Stay connected with your recruitment team through the candidate portal.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
      This message was sent via VerticalHire. To manage your notification preferences, visit your portal settings.
    </p>
  </div>
</body>
</html>`

  const textBody = `Hi ${candidateName},

You have a new message from ${senderName} at ${companyName}:

"${messagePreview}"

View and reply to this message: ${portalUrl}

Stay connected with your recruitment team through the candidate portal.

---
This message was sent via VerticalHire. To manage your notification preferences, visit your portal settings.`

  // Use Resend if available, otherwise log
  if (env.RESEND_API_KEY) {
    const { Resend } = await import('resend')
    const resend = new Resend(env.RESEND_API_KEY)

    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL || 'notifications@verticalhire.com',
      to: candidateEmail,
      subject,
      html: htmlBody,
      text: textBody,
    })
  } else {
    logger.info({
      message: 'Would send message notification (no RESEND_API_KEY)',
      candidateEmail,
      subject,
      senderName,
      companyName,
    })
  }
}
