import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'

const logger = createLogger('email:interview-rescheduled')

interface InterviewRescheduledParams {
  recipientEmail: string
  recipientName: string
  candidateName: string
  jobTitle: string | null
  oldScheduledAt: Date
  newScheduledAt: Date
  durationMinutes: number
  zoomJoinUrl?: string
  passcode?: string
  isCandidate: boolean
}

export async function sendInterviewRescheduled(params: InterviewRescheduledParams): Promise<void> {
  const {
    recipientEmail,
    recipientName,
    candidateName,
    jobTitle,
    oldScheduledAt,
    newScheduledAt,
    durationMinutes,
    zoomJoinUrl,
    passcode,
    isCandidate,
  } = params

  const formatDateTime = (date: Date) => ({
    date: date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }),
  })

  const oldDateTime = formatDateTime(oldScheduledAt)
  const newDateTime = formatDateTime(newScheduledAt)

  const subject = isCandidate
    ? `Interview Rescheduled${jobTitle ? ` - ${jobTitle}` : ''}`
    : `Interview Rescheduled with ${candidateName}`

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Interview Rescheduled</h1>
  </div>

  <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Hi ${recipientName},</p>

    <p>Your interview${isCandidate ? (jobTitle ? ` for the <strong>${jobTitle}</strong> position` : '') : ` with <strong>${candidateName}</strong>`} has been rescheduled.</p>

    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #92400e;">Time Change</h3>

      <div style="margin-bottom: 16px;">
        <p style="margin: 0; font-size: 14px; color: #78350f; text-decoration: line-through;">
          <strong>Previous Time:</strong><br>
          ${oldDateTime.date}<br>
          ${oldDateTime.time}
        </p>
      </div>

      <div>
        <p style="margin: 0; font-size: 14px; color: #78350f;">
          <strong>New Time:</strong><br>
          <span style="font-size: 16px; font-weight: 600; color: #92400e;">${newDateTime.date}</span><br>
          <span style="font-size: 16px; font-weight: 600; color: #92400e;">${newDateTime.time}</span>
        </p>
      </div>
    </div>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date</td>
          <td style="padding: 8px 0; font-weight: 600;">${newDateTime.date}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Time</td>
          <td style="padding: 8px 0; font-weight: 600;">${newDateTime.time}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Duration</td>
          <td style="padding: 8px 0; font-weight: 600;">${durationMinutes} minutes</td>
        </tr>
      </table>
    </div>

    ${zoomJoinUrl ? `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${zoomJoinUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        Join Video Call
      </a>
    </div>
    ${passcode ? `<p style="text-align: center; font-size: 14px; color: #64748b;">Passcode: <strong>${passcode}</strong></p>` : ''}
    ` : ''}

    ${isCandidate ? `
    <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #1e40af;">Preparation Tips</h3>
      <ul style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 14px;">
        <li>Test your audio and video equipment beforehand</li>
        <li>Find a quiet location with good lighting</li>
        <li>Have your resume and any relevant materials ready</li>
        <li>Prepare questions to ask the interviewer</li>
      </ul>
    </div>
    ` : ''}

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
      This is an automated notification from VerticalHire. If you need to reschedule again, please contact your recruiter.
    </p>
  </div>
</body>
</html>`

  const textBody = `Hi ${recipientName},

Your interview${isCandidate ? (jobTitle ? ` for the ${jobTitle} position` : '') : ` with ${candidateName}`} has been rescheduled.

PREVIOUS TIME:
${oldDateTime.date}
${oldDateTime.time}

NEW TIME:
${newDateTime.date}
${newDateTime.time}

Duration: ${durationMinutes} minutes

${zoomJoinUrl ? `Join Video Call: ${zoomJoinUrl}${passcode ? `\nPasscode: ${passcode}` : ''}` : ''}

---
This is an automated notification from VerticalHire. If you need to reschedule again, please contact your recruiter.`

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
      message: 'Would send interview rescheduled notification (no RESEND_API_KEY)',
      recipientEmail,
      subject,
      oldTime: oldScheduledAt.toISOString(),
      newTime: newScheduledAt.toISOString(),
    })
  }
}
