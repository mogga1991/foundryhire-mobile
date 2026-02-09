interface OfferRejectedParams {
  recruiterEmail: string
  recruiterName: string
  candidateName: string
  jobTitle: string
  companyName: string
  rejectedAt: Date
  reason?: string
  dashboardUrl: string
}

export async function sendOfferRejected(params: OfferRejectedParams): Promise<void> {
  const {
    recruiterEmail,
    recruiterName,
    candidateName,
    jobTitle,
    companyName,
    rejectedAt,
    reason,
    dashboardUrl,
  } = params

  const formattedDate = rejectedAt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const formattedTime = rejectedAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  const subject = `Offer Declined - ${candidateName} for ${jobTitle}`

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Offer Declined</h1>
  </div>

  <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Hi ${recruiterName},</p>

    <p><strong>${candidateName}</strong> has declined the offer for the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>.</p>

    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #991b1b; font-size: 14px;">Candidate</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${candidateName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #991b1b; font-size: 14px;">Position</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${jobTitle}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #991b1b; font-size: 14px;">Declined On</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #991b1b; font-size: 14px;">Time</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${formattedTime}</td>
        </tr>
      </table>
    </div>

    ${reason ? `
    <div style="background: #f8fafc; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Reason provided:</p>
      <p style="margin: 0; color: #64748b;">${reason}</p>
    </div>
    ` : ''}

    <div style="text-align: center; margin: 32px 0;">
      <a href="${dashboardUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        View Candidate Dashboard
      </a>
    </div>

    <p style="font-size: 14px; color: #64748b;">
      Consider reaching out to understand their decision better and maintain a positive relationship for future opportunities.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
      This notification was sent via VerticalHire recruitment platform.
    </p>
  </div>
</body>
</html>`

  const textBody = `Hi ${recruiterName},

${candidateName} has declined the offer for the ${jobTitle} position at ${companyName}.

Decline Details:
- Candidate: ${candidateName}
- Position: ${jobTitle}
- Declined On: ${formattedDate}
- Time: ${formattedTime}
${reason ? `\nReason provided:\n${reason}` : ''}

View candidate dashboard: ${dashboardUrl}

Consider reaching out to understand their decision better and maintain a positive relationship for future opportunities.

---
This notification was sent via VerticalHire recruitment platform.`

  // Use Resend if available, otherwise log
  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'notifications@verticalhire.com',
      to: recruiterEmail,
      subject,
      html: htmlBody,
      text: textBody,
    })
  } else {
    console.log(`[Offer Rejected] Would send to ${recruiterEmail}:`, {
      subject,
      candidateName,
      jobTitle,
    })
  }
}
