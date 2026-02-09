interface OnboardingCompleteParams {
  candidateEmail: string
  candidateName: string
  jobTitle: string
  companyName: string
  startDate: Date
  completedTasks: number
  portalUrl: string
}

export async function sendOnboardingComplete(params: OnboardingCompleteParams): Promise<void> {
  const {
    candidateEmail,
    candidateName,
    jobTitle,
    companyName,
    startDate,
    completedTasks,
    portalUrl,
  } = params

  const formattedStartDate = startDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const subject = `🎉 Onboarding Complete - Ready for Your First Day at ${companyName}!`

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Onboarding Complete!</h1>
  </div>

  <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Hi ${candidateName},</p>

    <p>Congratulations! You've successfully completed all your onboarding tasks. You're all set and ready to start your journey as <strong>${jobTitle}</strong> at <strong>${companyName}</strong>!</p>

    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
      <div style="width: 64px; height: 64px; background: #10b981; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 32px;">
        ✓
      </div>
      <p style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #166534;">${completedTasks} Tasks Completed</p>
      <p style="margin: 0; color: #166534; font-size: 14px;">Great work completing your onboarding!</p>
    </div>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Position</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${jobTitle}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Company</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${companyName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Start Date</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${formattedStartDate}</td>
        </tr>
      </table>
    </div>

    <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e293b;">What's next:</p>
      <ul style="margin: 0; padding-left: 20px; color: #475569;">
        <li style="margin: 4px 0;">Mark your calendar for your first day</li>
        <li style="margin: 4px 0;">Prepare any materials you'll need</li>
        <li style="margin: 4px 0;">Get a good night's sleep before your start date</li>
        <li style="margin: 4px 0;">Arrive ready to meet your new team!</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        View Your Portal
      </a>
    </div>

    <p style="font-size: 14px; color: #64748b;">
      You can still access your onboarding portal for reference materials and resources. We're excited to see you on your first day!
    </p>

    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1e293b;">See you on ${formattedStartDate}!</p>
      <p style="margin: 0; color: #64748b; font-size: 14px;">The entire ${companyName} team is looking forward to working with you.</p>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
      This notification was sent via VerticalHire onboarding system. Welcome to the team!
    </p>
  </div>
</body>
</html>`

  const textBody = `Hi ${candidateName},

Congratulations! You've successfully completed all your onboarding tasks. You're all set and ready to start your journey as ${jobTitle} at ${companyName}!

✓ ${completedTasks} Tasks Completed
Great work completing your onboarding!

Your Details:
- Position: ${jobTitle}
- Company: ${companyName}
- Start Date: ${formattedStartDate}

What's next:
- Mark your calendar for your first day
- Prepare any materials you'll need
- Get a good night's sleep before your start date
- Arrive ready to meet your new team!

View your portal: ${portalUrl}

You can still access your onboarding portal for reference materials and resources. We're excited to see you on your first day!

See you on ${formattedStartDate}!
The entire ${companyName} team is looking forward to working with you.

---
This notification was sent via VerticalHire onboarding system. Welcome to the team!`

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
    console.log(`[Onboarding Complete] Would send to ${candidateEmail}:`, {
      subject,
      jobTitle,
      companyName,
    })
  }
}
