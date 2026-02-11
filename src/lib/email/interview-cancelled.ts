import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'

const logger = createLogger('email:interview-cancelled')

interface InterviewCancelledParams {
  recipientEmail: string
  recipientName: string
  candidateName: string
  jobTitle: string | null
  scheduledAt: Date
  durationMinutes: number
  cancelReason?: string
  nextSteps?: string
  isCandidate: boolean
}

export async function sendInterviewCancelled(params: InterviewCancelledParams): Promise<void> {
  const {
    recipientEmail,
    recipientName,
    candidateName,
    jobTitle,
    scheduledAt,
    durationMinutes,
    cancelReason,
    nextSteps,
    isCandidate,
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

  const subject = isCandidate
    ? `Interview Cancelled${jobTitle ? ` - ${jobTitle}` : ''}`
    : `Interview Cancelled with ${candidateName}`

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Interview Cancelled</h1>
  </div>

  <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Hi ${recipientName},</p>

    <p>We're writing to inform you that your interview${isCandidate ? (jobTitle ? ` for the <strong>${jobTitle}</strong> position` : '') : ` with <strong>${candidateName}</strong>`} has been cancelled.</p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date</td>
          <td style="padding: 8px 0; font-weight: 600; text-decoration: line-through;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Time</td>
          <td style="padding: 8px 0; font-weight: 600; text-decoration: line-through;">${formattedTime}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Duration</td>
          <td style="padding: 8px 0; font-weight: 600; text-decoration: line-through;">${durationMinutes} minutes</td>
        </tr>
      </table>
    </div>

    ${cancelReason ? `
    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #991b1b;">Reason</h3>
      <p style="margin: 0; color: #7f1d1d; font-size: 14px;">${cancelReason}</p>
    </div>
    ` : ''}

    ${nextSteps ? `
    <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #1e40af;">Next Steps</h3>
      <p style="margin: 0; color: #1e3a8a; font-size: 14px;">${nextSteps}</p>
    </div>
    ` : isCandidate ? `
    <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #1e40af;">Next Steps</h3>
      <p style="margin: 0; color: #1e3a8a; font-size: 14px;">Your recruiter will reach out to discuss rescheduling or next steps in the hiring process. If you have any questions, please don't hesitate to reply to this email.</p>
    </div>
    ` : ''}

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
      This is an automated notification from VerticalHire. If you have any questions, please contact your recruiter.
    </p>
  </div>
</body>
</html>`

  const textBody = `Hi ${recipientName},

We're writing to inform you that your interview${isCandidate ? (jobTitle ? ` for the ${jobTitle} position` : '') : ` with ${candidateName}`} has been cancelled.

CANCELLED INTERVIEW:
Date: ${formattedDate}
Time: ${formattedTime}
Duration: ${durationMinutes} minutes

${cancelReason ? `REASON:\n${cancelReason}\n\n` : ''}${nextSteps ? `NEXT STEPS:\n${nextSteps}` : isCandidate ? `NEXT STEPS:\nYour recruiter will reach out to discuss rescheduling or next steps in the hiring process. If you have any questions, please don't hesitate to reply to this email.` : ''}

---
This is an automated notification from VerticalHire. If you have any questions, please contact your recruiter.`

  // Use Resend if available, otherwise log
  if (env.RESEND_API_KEY) {
    const { Resend } = await import('resend')
    const resend = new Resend(env.RESEND_API_KEY)

    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL || 'interviews@verticalhire.com',
      to: recipientEmail,
      subject,
      html: htmlBody,
      text: textBody,
    })
  } else {
    logger.info({
      message: 'Would send interview cancelled notification (no RESEND_API_KEY)',
      recipientEmail,
      subject,
      scheduledAt: scheduledAt.toISOString(),
      cancelReason,
    })
  }
}
