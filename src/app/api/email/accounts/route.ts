import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { emailAccounts, domainIdentities } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET() {
  try {
    const { companyId } = await requireCompanyAccess()

    const accounts = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.companyId, companyId))

    return NextResponse.json({ data: accounts })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, companyId } = await requireCompanyAccess()
    const body = await request.json()
    const { type, displayName, fromAddress, fromName, isDefault } = body

    if (!type || !displayName || !fromAddress) {
      return NextResponse.json(
        { error: 'type, displayName, and fromAddress are required' },
        { status: 400 }
      )
    }

    // For ESP type, validate domain is verified
    if (type === 'esp') {
      const domain = fromAddress.split('@')[1]
      const [domainIdentity] = await db
        .select()
        .from(domainIdentities)
        .where(and(
          eq(domainIdentities.companyId, companyId),
          eq(domainIdentities.domain, domain),
          eq(domainIdentities.dkimStatus, 'verified')
        ))
        .limit(1)

      if (!domainIdentity) {
        return NextResponse.json(
          { error: `Domain ${domain} is not verified. Please verify it first.` },
          { status: 400 }
        )
      }
    }

    // If setting as default, unset other defaults first
    if (isDefault) {
      await db
        .update(emailAccounts)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(
          eq(emailAccounts.companyId, companyId),
          eq(emailAccounts.isDefault, true)
        ))
    }

    const capabilities = {
      supportsInbound: false,
      supportsWebhooks: type === 'esp',
      supportsThreading: type === 'gmail_oauth' || type === 'microsoft_oauth',
      ...(type === 'gmail_oauth' ? { maxDailyLimit: 500 } : {}),
      ...(type === 'microsoft_oauth' ? { maxDailyLimit: 10000 } : {}),
    }

    const [account] = await db
      .insert(emailAccounts)
      .values({
        companyId,
        type,
        displayName,
        fromAddress,
        fromName: fromName || null,
        status: type === 'esp' ? 'active' : 'pending',
        capabilities,
        isDefault: isDefault ?? false,
        createdBy: user.id,
      })
      .returning()

    return NextResponse.json({ data: account }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
