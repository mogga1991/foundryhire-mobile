import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'

const logger = createLogger('email:feedback-notification')

interface FeedbackNotificationParams {
  recipientEmail: string
  recipientName: string
  candidateName: string
  interviewerName: string
  interviewDate: Date
  rating: number
  recommendation?: string
  feedbackUrl: string
}

export async function sendFeedbackNotification(params: FeedbackNotificationParams): Promise<void> {
  const {
    recipientEmail,
    recipientName,
    candidateName,
    interviewerName,
    interviewDate,
    rating,
    recommendation,
    feedbackUrl,
  } = params

  const formattedDate = interviewDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const formattedTime = interviewDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  const subject = `New Feedback: Interview with ${candidateName}`

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">New Interview Feedback</h1>
  </div>

  <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Hi ${recipientName},</p>

    <p><strong>${interviewerName}</strong> has submitted feedback for the interview with <strong>${candidateName}</strong>.</p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Candidate</td>
          <td style="padding: 8px 0; font-weight: 600;">${candidateName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Interviewer</td>
          <td style="padding: 8px 0; font-weight: 600;">${interviewerName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Interview Date</td>
          <td style="padding: 8px 0; font-weight: 600;">${formattedDate} at ${formattedTime}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Rating</td>
          <td style="padding: 8px 0; font-weight: 600;">${rating}/10</td>
        </tr>
        ${recommendation ? `
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Recommendation</td>
          <td style="padding: 8px 0; font-weight: 600; text-transform: capitalize;">${recommendation}</td>
        </tr>
        ` : ''}
      </table>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${feedbackUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        View Full Feedback
      </a>
    </div>

    <p style="font-size: 14px; color: #64748b;">
      Review the complete feedback, compare with other team members' assessments, and make informed hiring decisions.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
      This notification was sent by VerticalHire. To manage your notification preferences, visit your account settings.
    </p>
  </div>
</body>
</html>`

  // Use Resend if available, otherwise log
  if (env.RESEND_API_KEY) {
    const { Resend } = await import('resend')
    const resend = new Resend(env.RESEND_API_KEY)

    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL || 'notifications@verticalhire.com',
      to: recipientEmail,
      subject,
      html: htmlBody,
    })
  } else {
    logger.info({
      message: 'Would send feedback notification (no RESEND_API_KEY)',
      recipientEmail,
      subject,
      candidateName,
      interviewerName,
      rating,
    })
  }
}
