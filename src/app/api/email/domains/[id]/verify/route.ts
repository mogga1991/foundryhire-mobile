import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { domainIdentities } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { ResendProvider } from '@/lib/email/providers/resend-provider'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { companyId } = await requireCompanyAccess()

    const [domain] = await db
      .select()
      .from(domainIdentities)
      .where(and(eq(domainIdentities.id, id), eq(domainIdentities.companyId, companyId)))
      .limit(1)

    if (!domain) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 })
    }

    if (!domain.resendDomainId) {
      return NextResponse.json({ error: 'Domain has no Resend ID' }, { status: 400 })
    }

    // Trigger verification check in Resend
    const resend = new ResendProvider()
    await resend.verifyDomain(domain.resendDomainId)

    // Fetch updated domain status
    const resendDomain = await resend.getDomain(domain.resendDomainId)

    const now = new Date()
    const dkimVerified = resendDomain?.status === 'verified'
    const spfVerified = dkimVerified // Resend verifies both together

    const [updated] = await db
      .update(domainIdentities)
      .set({
        dkimStatus: dkimVerified ? 'verified' : 'pending',
        spfStatus: spfVerified ? 'verified' : 'pending',
        dkimRecords: resendDomain?.records ?? domain.dkimRecords,
        verifiedAt: dkimVerified ? now : null,
        lastCheckedAt: now,
        updatedAt: now,
      })
      .where(eq(domainIdentities.id, id))
      .returning()

    return NextResponse.json({
      data: updated,
      verified: dkimVerified,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
