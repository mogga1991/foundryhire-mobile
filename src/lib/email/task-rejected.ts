interface TaskRejectedParams {
  candidateEmail: string
  candidateName: string
  taskTitle: string
  rejectionReason: string
  rejectedBy: string
  companyName: string
  portalUrl: string
}

export async function sendTaskRejected(params: TaskRejectedParams): Promise<void> {
  const {
    candidateEmail,
    candidateName,
    taskTitle,
    rejectionReason,
    rejectedBy,
    companyName,
    portalUrl,
  } = params

  const subject = `Action Required: Task Needs Revision - ${taskTitle}`

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Task Needs Revision</h1>
  </div>

  <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Hi ${candidateName},</p>

    <p>Your submission for the onboarding task <strong>"${taskTitle}"</strong> has been reviewed and needs some revisions before it can be approved.</p>

    <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #1e293b;">${taskTitle}</p>
      <p style="margin: 0; font-size: 12px; color: #9a3412; font-weight: 600; text-transform: uppercase;">Reviewed by ${rejectedBy}</p>
    </div>

    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e293b;">Feedback:</p>
      <p style="margin: 0; color: #475569;">${rejectionReason}</p>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: #f97316; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        Revise and Resubmit
      </a>
    </div>

    <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e293b;">Next steps:</p>
      <ul style="margin: 0; padding-left: 20px; color: #475569;">
        <li style="margin: 4px 0;">Review the feedback carefully</li>
        <li style="margin: 4px 0;">Make the necessary changes</li>
        <li style="margin: 4px 0;">Resubmit the task for approval</li>
      </ul>
    </div>

    <p style="font-size: 14px; color: #64748b;">
      Don't worry - this is a normal part of the onboarding process. If you have questions about the feedback or need clarification, reach out to ${rejectedBy} or your HR contact at ${companyName}.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
      This notification was sent via VerticalHire onboarding system.
    </p>
  </div>
</body>
</html>`

  const textBody = `Hi ${candidateName},

Your submission for the onboarding task "${taskTitle}" has been reviewed and needs some revisions before it can be approved.

Task: ${taskTitle}
Reviewed by: ${rejectedBy}

Feedback:
${rejectionReason}

Next steps:
- Review the feedback carefully
- Make the necessary changes
- Resubmit the task for approval

Revise and resubmit: ${portalUrl}

Don't worry - this is a normal part of the onboarding process. If you have questions about the feedback or need clarification, reach out to ${rejectedBy} or your HR contact at ${companyName}.

---
This notification was sent via VerticalHire onboarding system.`

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
    console.log(`[Task Rejected] Would send to ${candidateEmail}:`, {
      subject,
      taskTitle,
      rejectedBy,
    })
  }
}
