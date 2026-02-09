import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { emailAccounts, emailAccountSecrets } from '@/lib/db/schema'
import { encrypt } from '@/lib/utils/encryption'
import nodemailer from 'nodemailer'

export async function POST(request: NextRequest) {
  try {
    const { companyId } = await requireCompanyAccess()
    const body = await request.json()
    const { host, port, username, password, fromAddress, fromName, useTls } = body

    if (!host || !port || !username || !password || !fromAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: host, port, username, password, fromAddress' },
        { status: 400 }
      )
    }

    // Test the SMTP connection
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: useTls ?? true,
      auth: { user: username, pass: password },
    })

    try {
      await transporter.verify()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      return NextResponse.json(
        { error: `SMTP connection test failed: ${message}` },
        { status: 400 }
      )
    }

    // Create email account
    const [account] = await db
      .insert(emailAccounts)
      .values({
        companyId,
        type: 'smtp',
        displayName: fromName || fromAddress,
        fromAddress,
        fromName: fromName || null,
        status: 'active',
        capabilities: {
          supportsInbound: false,
          supportsWebhooks: false,
          supportsThreading: false,
        },
      })
      .returning()

    // Store encrypted credentials
    const encryptedData = encrypt(
      JSON.stringify({
        host,
        port: Number(port),
        username,
        password,
        useTls: useTls ?? true,
      })
    )

    await db.insert(emailAccountSecrets).values({
      emailAccountId: account.id,
      encryptedData,
    })

    return NextResponse.json({ data: account })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[SMTP Connect] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
