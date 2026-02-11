import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { domainIdentities } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { ResendProvider } from '@/lib/email/providers/resend-provider'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

export async function GET(
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

    return NextResponse.json({ data: domain })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function _DELETE(
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

    // Remove from Resend if it has a Resend domain ID
    if (domain.resendDomainId) {
      try {
        const resend = new ResendProvider()
        await resend.deleteDomain(domain.resendDomainId)
      } catch {
        // Continue with local delete even if Resend delete fails
      }
    }

    await db
      .delete(domainIdentities)
      .where(eq(domainIdentities.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const DELETE = withApiMiddleware(_DELETE, { csrfProtection: true })
