import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { domainIdentities } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { ResendProvider } from '@/lib/email/providers/resend-provider'

export async function GET() {
  try {
    const { companyId } = await requireCompanyAccess()

    const domains = await db
      .select()
      .from(domainIdentities)
      .where(eq(domainIdentities.companyId, companyId))

    return NextResponse.json({ data: domains })
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
    const { companyId } = await requireCompanyAccess()
    const { domain } = await request.json()

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 })
    }

    const cleanDomain = domain.toLowerCase().trim()

    // Check if domain already exists
    const [existing] = await db
      .select()
      .from(domainIdentities)
      .where(eq(domainIdentities.domain, cleanDomain))
      .limit(1)

    if (existing) {
      return NextResponse.json({ error: 'Domain already registered' }, { status: 409 })
    }

    // Create domain in Resend
    const resend = new ResendProvider()
    const resendDomain = await resend.createDomain(cleanDomain)

    // Store domain identity with DNS records from Resend
    const [identity] = await db
      .insert(domainIdentities)
      .values({
        companyId,
        domain: cleanDomain,
        resendDomainId: resendDomain?.id ?? null,
        dkimStatus: 'pending',
        spfStatus: 'pending',
        dkimRecords: resendDomain?.records ?? null,
      })
      .returning()

    return NextResponse.json({ data: identity }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
