interface TaskReminderParams {
  candidateEmail: string
  candidateName: string
  taskTitle: string
  taskDescription?: string
  dueDate: Date
  daysOverdue: number
  companyName: string
  portalUrl: string
}

export async function sendTaskReminder(params: TaskReminderParams): Promise<void> {
  const {
    candidateEmail,
    candidateName,
    taskTitle,
    taskDescription,
    dueDate,
    daysOverdue,
    companyName,
    portalUrl,
  } = params

  const formattedDueDate = dueDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const urgencyLevel = daysOverdue >= 3 ? 'high' : 'medium'
  const urgencyColor = urgencyLevel === 'high' ? '#ef4444' : '#f97316'
  const urgencyBg = urgencyLevel === 'high' ? '#fef2f2' : '#fff7ed'
  const urgencyBorder = urgencyLevel === 'high' ? '#fecaca' : '#fed7aa'

  const subject = `⏰ Reminder: Overdue Onboarding Task - ${taskTitle}`

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, ${urgencyColor}, ${urgencyLevel === 'high' ? '#dc2626' : '#ea580c'}); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Task Reminder</h1>
  </div>

  <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Hi ${candidateName},</p>

    <p>This is a reminder that you have an overdue onboarding task that needs your attention.</p>

    <div style="background: ${urgencyBg}; border: 1px solid ${urgencyBorder}; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #1e293b;">${taskTitle}</p>
      ${taskDescription ? `
      <p style="margin: 0 0 12px 0; color: #475569;">${taskDescription}</p>
      ` : ''}
      <div style="display: flex; align-items: center; gap: 8px; margin-top: 16px;">
        <div style="flex: 1;">
          <p style="margin: 0; font-size: 12px; color: ${urgencyColor}; font-weight: 600; text-transform: uppercase;">Overdue By</p>
          <p style="margin: 0; font-size: 20px; font-weight: 700; color: ${urgencyColor};">${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}</p>
        </div>
        <div style="flex: 1; text-align: right;">
          <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Due Date</p>
          <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b;">${formattedDueDate}</p>
        </div>
      </div>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: ${urgencyColor}; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        Complete Task Now
      </a>
    </div>

    <p style="font-size: 14px; color: #64748b;">
      Completing your onboarding tasks on time helps ensure a smooth start at ${companyName}. If you're experiencing any issues or need assistance, please reach out to your HR contact.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
      This reminder was sent via VerticalHire onboarding system. If you've already completed this task, please disregard this message.
    </p>
  </div>
</body>
</html>`

  const textBody = `Hi ${candidateName},

This is a reminder that you have an overdue onboarding task that needs your attention.

Task: ${taskTitle}
${taskDescription ? `Description: ${taskDescription}\n` : ''}
Due Date: ${formattedDueDate}
Overdue By: ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}

Complete task now: ${portalUrl}

Completing your onboarding tasks on time helps ensure a smooth start at ${companyName}. If you're experiencing any issues or need assistance, please reach out to your HR contact.

---
This reminder was sent via VerticalHire onboarding system. If you've already completed this task, please disregard this message.`

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
    console.log(`[Task Reminder] Would send to ${candidateEmail}:`, {
      subject,
      taskTitle,
      daysOverdue,
    })
  }
}
