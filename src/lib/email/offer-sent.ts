interface OfferSentParams {
  candidateEmail: string
  candidateName: string
  jobTitle: string
  companyName: string
  salary?: string
  startDate?: Date
  expiresAt: Date
  portalUrl: string
}

export async function sendOfferSent(params: OfferSentParams): Promise<void> {
  const {
    candidateEmail,
    candidateName,
    jobTitle,
    companyName,
    salary,
    startDate,
    expiresAt,
    portalUrl,
  } = params

  const formattedExpiryDate = expiresAt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const formattedStartDate = startDate?.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const subject = `Job Offer - ${jobTitle} at ${companyName}`

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Congratulations!</h1>
  </div>

  <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Hi ${candidateName},</p>

    <p>We're thrilled to extend you an offer to join <strong>${companyName}</strong> as a <strong>${jobTitle}</strong>!</p>

    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #166534; font-size: 14px;">Position</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${jobTitle}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #166534; font-size: 14px;">Company</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${companyName}</td>
        </tr>
        ${salary ? `
        <tr>
          <td style="padding: 8px 0; color: #166534; font-size: 14px;">Salary</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${salary}</td>
        </tr>
        ` : ''}
        ${startDate ? `
        <tr>
          <td style="padding: 8px 0; color: #166534; font-size: 14px;">Start Date</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${formattedStartDate}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 8px 0; color: #166534; font-size: 14px;">Offer Expires</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${formattedExpiryDate}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        Review Your Offer
      </a>
    </div>

    <p style="font-size: 14px; color: #64748b;">
      Please review the complete offer details, including benefits and terms, in your candidate portal. You can accept or decline the offer directly from there.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
      This offer was sent via VerticalHire. If you have questions, please reach out to your recruitment contact.
    </p>
  </div>
</body>
</html>`

  const textBody = `Hi ${candidateName},

Congratulations! We're thrilled to extend you an offer to join ${companyName} as a ${jobTitle}!

Offer Details:
- Position: ${jobTitle}
- Company: ${companyName}
${salary ? `- Salary: ${salary}` : ''}
${startDate ? `- Start Date: ${formattedStartDate}` : ''}
- Offer Expires: ${formattedExpiryDate}

Review your complete offer: ${portalUrl}

Please review the complete offer details, including benefits and terms, in your candidate portal. You can accept or decline the offer directly from there.

---
This offer was sent via VerticalHire. If you have questions, please reach out to your recruitment contact.`

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
    console.log(`[Offer Sent] Would send to ${candidateEmail}:`, {
      subject,
      jobTitle,
      companyName,
    })
  }
}
