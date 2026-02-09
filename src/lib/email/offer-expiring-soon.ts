interface OfferExpiringSoonParams {
  candidateEmail: string
  candidateName: string
  jobTitle: string
  companyName: string
  expiresAt: Date
  hoursRemaining: number
  portalUrl: string
}

export async function sendOfferExpiringSoon(params: OfferExpiringSoonParams): Promise<void> {
  const {
    candidateEmail,
    candidateName,
    jobTitle,
    companyName,
    expiresAt,
    hoursRemaining,
    portalUrl,
  } = params

  const formattedExpiryDate = expiresAt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const formattedExpiryTime = expiresAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  const urgencyLevel = hoursRemaining <= 24 ? 'high' : 'medium'
  const urgencyColor = urgencyLevel === 'high' ? '#ef4444' : '#f97316'
  const urgencyBg = urgencyLevel === 'high' ? '#fef2f2' : '#fff7ed'
  const urgencyBorder = urgencyLevel === 'high' ? '#fecaca' : '#fed7aa'

  const subject = `⏰ Reminder: Your offer from ${companyName} expires ${hoursRemaining <= 24 ? 'soon' : `in ${Math.round(hoursRemaining / 24)} days`}`

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, ${urgencyColor}, ${urgencyLevel === 'high' ? '#dc2626' : '#ea580c'}); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Offer Expiring Soon</h1>
  </div>

  <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Hi ${candidateName},</p>

    <p>This is a friendly reminder that your offer for the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong> is expiring soon.</p>

    <div style="background: ${urgencyBg}; border: 1px solid ${urgencyBorder}; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: ${urgencyColor}; font-weight: 600; text-transform: uppercase;">Time Remaining</p>
      <p style="margin: 0; font-size: 32px; font-weight: 700; color: ${urgencyColor};">${hoursRemaining} hours</p>
      <p style="margin: 16px 0 0 0; font-size: 14px; color: #64748b;">
        Expires: ${formattedExpiryDate} at ${formattedExpiryTime}
      </p>
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
      </table>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: ${urgencyColor}; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        Review and Respond Now
      </a>
    </div>

    <p style="font-size: 14px; color: #64748b;">
      Please review the offer details and make your decision before the expiration time. If you need more time or have questions, reach out to your recruitment contact.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
      This reminder was sent via VerticalHire. If you've already responded, please disregard this message.
    </p>
  </div>
</body>
</html>`

  const textBody = `Hi ${candidateName},

This is a friendly reminder that your offer for the ${jobTitle} position at ${companyName} is expiring soon.

TIME REMAINING: ${hoursRemaining} hours
Expires: ${formattedExpiryDate} at ${formattedExpiryTime}

Position: ${jobTitle}
Company: ${companyName}

Review and respond now: ${portalUrl}

Please review the offer details and make your decision before the expiration time. If you need more time or have questions, reach out to your recruitment contact.

---
This reminder was sent via VerticalHire. If you've already responded, please disregard this message.`

  // Use Resend if available, otherwise log
  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'offers@verticalhire.com',
      to: candidateEmail,
      subject,
      html: htmlBody,
      text: textBody,
    })
  } else {
    console.log(`[Offer Expiring Soon] Would send to ${candidateEmail}:`, {
      subject,
      jobTitle,
      hoursRemaining,
    })
  }
}
