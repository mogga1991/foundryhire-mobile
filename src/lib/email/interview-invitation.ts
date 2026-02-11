import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'

const logger = createLogger('email:interview-invitation')

interface InterviewInvitationParams {
  candidateEmail: string
  candidateName: string
  scheduledAt: Date
  durationMinutes: number
  jobTitle: string | null
  portalUrl: string
  zoomJoinUrl?: string
}

export async function sendInterviewInvitation(params: InterviewInvitationParams): Promise<void> {
  const {
    candidateEmail,
    candidateName,
    scheduledAt,
    durationMinutes,
    jobTitle,
    portalUrl,
    zoomJoinUrl,
  } = params

  const formattedDate = scheduledAt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const formattedTime = scheduledAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  const subject = jobTitle
    ? `Interview Invitation - ${jobTitle}`
    : 'Interview Invitation'

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Interview Invitation</h1>
  </div>

  <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Hi ${candidateName},</p>

    <p>We're excited to invite you to an interview${jobTitle ? ` for the <strong>${jobTitle}</strong> position` : ''}. Here are the details:</p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date</td>
          <td style="padding: 8px 0; font-weight: 600;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Time</td>
          <td style="padding: 8px 0; font-weight: 600;">${formattedTime}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Duration</td>
          <td style="padding: 8px 0; font-weight: 600;">${durationMinutes} minutes</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Format</td>
          <td style="padding: 8px 0; font-weight: 600;">Video Interview</td>
        </tr>
      </table>
    </div>

    ${zoomJoinUrl ? `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${zoomJoinUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        Join Video Call
      </a>
    </div>
    ` : ''}

    <div style="text-align: center; margin: 24px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: #f97316; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        Prepare for Your Interview
      </a>
    </div>

    <p style="font-size: 14px; color: #64748b;">
      Use the preparation portal to review the role details, practice common questions, and make sure you're ready to impress.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
      This interview was scheduled via VerticalHire. If you need to reschedule, please reply to this email.
    </p>
  </div>
</body>
</html>`

  // Use Resend if available, otherwise log
  if (env.RESEND_API_KEY) {
    const { Resend } = await import('resend')
    const resend = new Resend(env.RESEND_API_KEY)

    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL || 'interviews@verticalhire.com',
      to: candidateEmail,
      subject,
      html: htmlBody,
    })
  } else {
    logger.info({
      message: 'Would send interview invitation (no RESEND_API_KEY)',
      candidateEmail,
      subject,
      scheduledAt: scheduledAt.toISOString(),
      portalUrl,
    })
  }
}
