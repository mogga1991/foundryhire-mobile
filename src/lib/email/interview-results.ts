import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'

const logger = createLogger('email:interview-results')

interface InterviewResultsParams {
  candidateEmail: string
  candidateName: string
  jobTitle: string | null
  interviewDate: Date
  outcome: 'positive' | 'neutral' | 'declined'
  nextSteps: string
  feedbackSummary?: string
  portalUrl?: string
}

export async function sendInterviewResults(params: InterviewResultsParams): Promise<void> {
  const {
    candidateEmail,
    candidateName,
    jobTitle,
    interviewDate,
    outcome,
    nextSteps,
    feedbackSummary,
    portalUrl,
  } = params

  const formattedDate = interviewDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const outcomeConfig = {
    positive: {
      color: '#10b981',
      title: 'Great News!',
      message: 'Thank you for taking the time to interview with us. We were impressed with your background and experience.',
    },
    neutral: {
      color: '#3b82f6',
      title: 'Interview Update',
      message: 'Thank you for taking the time to interview with us. We appreciate your interest in our opportunity.',
    },
    declined: {
      color: '#64748b',
      title: 'Interview Update',
      message: 'Thank you for taking the time to interview with us. We appreciate the opportunity to learn more about your background and experience.',
    },
  }

  const config = outcomeConfig[outcome]

  const subject = jobTitle
    ? `Update on Your Interview - ${jobTitle}`
    : 'Interview Update'

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, ${config.color}, ${config.color}dd); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${config.title}</h1>
  </div>

  <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Hi ${candidateName},</p>

    <p>${config.message}</p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        ${jobTitle ? `
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Position</td>
          <td style="padding: 8px 0; font-weight: 600;">${jobTitle}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Interview Date</td>
          <td style="padding: 8px 0; font-weight: 600;">${formattedDate}</td>
        </tr>
      </table>
    </div>

    ${feedbackSummary ? `
    <div style="background: #fef9e7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #92400e;">Feedback</h3>
      <p style="margin: 0; color: #78350f; font-size: 14px;">${feedbackSummary}</p>
    </div>
    ` : ''}

    <div style="background: ${outcome === 'positive' ? '#f0fdf4' : '#eff6ff'}; border-left: 4px solid ${outcome === 'positive' ? '#10b981' : '#3b82f6'}; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <h3 style="margin: 0 0 8px 0; font-size: 16px; color: ${outcome === 'positive' ? '#166534' : '#1e40af'};">Next Steps</h3>
      <p style="margin: 0; color: ${outcome === 'positive' ? '#166534' : '#1e3a8a'}; font-size: 14px;">${nextSteps}</p>
    </div>

    ${portalUrl ? `
    <div style="text-align: center; margin: 32px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: ${config.color}; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        View Details
      </a>
    </div>
    ` : ''}

    ${outcome === 'declined' ? `
    <p style="font-size: 14px; color: #64748b; margin-top: 24px;">
      While we've decided to move forward with other candidates at this time, we were genuinely impressed by your qualifications. We encourage you to apply for future positions that match your skills and experience.
    </p>
    ` : ''}

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
      This notification was sent via VerticalHire. If you have any questions, please reach out to your recruitment contact.
    </p>
  </div>
</body>
</html>`

  const textBody = `Hi ${candidateName},

${config.message}

${jobTitle ? `Position: ${jobTitle}` : ''}
Interview Date: ${formattedDate}

${feedbackSummary ? `FEEDBACK:\n${feedbackSummary}\n\n` : ''}NEXT STEPS:
${nextSteps}

${portalUrl ? `View Details: ${portalUrl}\n\n` : ''}${outcome === 'declined' ? `While we've decided to move forward with other candidates at this time, we were genuinely impressed by your qualifications. We encourage you to apply for future positions that match your skills and experience.\n\n` : ''}---
This notification was sent via VerticalHire. If you have any questions, please reach out to your recruitment contact.`

  // Use Resend if available, otherwise log
  if (env.RESEND_API_KEY) {
    const { Resend } = await import('resend')
    const resend = new Resend(env.RESEND_API_KEY)

    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL || 'interviews@verticalhire.com',
      to: candidateEmail,
      subject,
      html: htmlBody,
      text: textBody,
    })
  } else {
    logger.info({
      message: 'Would send interview results notification (no RESEND_API_KEY)',
      candidateEmail,
      subject,
      outcome,
      jobTitle,
    })
  }
}
