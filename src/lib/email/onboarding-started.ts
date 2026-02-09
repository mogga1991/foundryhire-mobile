interface OnboardingStartedParams {
  candidateEmail: string
  candidateName: string
  jobTitle: string
  companyName: string
  startDate: Date
  totalTasks: number
  portalUrl: string
}

export async function sendOnboardingStarted(params: OnboardingStartedParams): Promise<void> {
  const {
    candidateEmail,
    candidateName,
    jobTitle,
    companyName,
    startDate,
    totalTasks,
    portalUrl,
  } = params

  const formattedStartDate = startDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const subject = `Welcome to ${companyName} - Let's Get Started!`

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Welcome to ${companyName}!</h1>
  </div>

  <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Hi ${candidateName},</p>

    <p>Congratulations on joining the team! We're thrilled to have you as our new <strong>${jobTitle}</strong>.</p>

    <p>Your onboarding journey has officially started. We've prepared everything you need to hit the ground running on your first day.</p>

    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #166534; font-size: 14px;">Your Start Date</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${formattedStartDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #166534; font-size: 14px;">Onboarding Tasks</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${totalTasks} tasks to complete</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        Start Your Onboarding
      </a>
    </div>

    <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e293b;">What to expect:</p>
      <ul style="margin: 0; padding-left: 20px; color: #475569;">
        <li style="margin: 4px 0;">Complete required documents and forms</li>
        <li style="margin: 4px 0;">Review company policies and guidelines</li>
        <li style="margin: 4px 0;">Set up your accounts and access</li>
        <li style="margin: 4px 0;">Get familiar with your team and resources</li>
      </ul>
    </div>

    <p style="font-size: 14px; color: #64748b;">
      Track your progress in the onboarding portal. If you have any questions or need assistance, don't hesitate to reach out to your recruitment contact or HR team.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
      This onboarding process is powered by VerticalHire. Welcome aboard!
    </p>
  </div>
</body>
</html>`

  const textBody = `Hi ${candidateName},

Welcome to ${companyName}!

Congratulations on joining the team! We're thrilled to have you as our new ${jobTitle}.

Your onboarding journey has officially started. We've prepared everything you need to hit the ground running on your first day.

Onboarding Details:
- Your Start Date: ${formattedStartDate}
- Onboarding Tasks: ${totalTasks} tasks to complete

What to expect:
- Complete required documents and forms
- Review company policies and guidelines
- Set up your accounts and access
- Get familiar with your team and resources

Start your onboarding: ${portalUrl}

Track your progress in the onboarding portal. If you have any questions or need assistance, don't hesitate to reach out to your recruitment contact or HR team.

---
This onboarding process is powered by VerticalHire. Welcome aboard!`

  // Use Resend if available, otherwise log
  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@verticalhire.com',
      to: candidateEmail,
      subject,
      html: htmlBody,
      text: textBody,
    })
  } else {
    console.log(`[Onboarding Started] Would send to ${candidateEmail}:`, {
      subject,
      jobTitle,
      companyName,
    })
  }
}
