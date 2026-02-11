import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { emailAccounts, emailAccountSecrets } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { companyId } = await requireCompanyAccess()

    const [account] = await db
      .select()
      .from(emailAccounts)
      .where(and(eq(emailAccounts.id, id), eq(emailAccounts.companyId, companyId)))
      .limit(1)

    if (!account) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 })
    }

    return NextResponse.json({ data: account })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function _PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { companyId } = await requireCompanyAccess()
    const body = await request.json()

    const [account] = await db
      .select()
      .from(emailAccounts)
      .where(and(eq(emailAccounts.id, id), eq(emailAccounts.companyId, companyId)))
      .limit(1)

    if (!account) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 })
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (body.displayName !== undefined) updates.displayName = body.displayName
    if (body.fromName !== undefined) updates.fromName = body.fromName

    if (body.isDefault === true) {
      // Unset other defaults first
      await db
        .update(emailAccounts)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(
          eq(emailAccounts.companyId, companyId),
          eq(emailAccounts.isDefault, true)
        ))
      updates.isDefault = true
    }

    const [updated] = await db
      .update(emailAccounts)
      .set(updates)
      .where(eq(emailAccounts.id, id))
      .returning()

    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
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

    const [account] = await db
      .select()
      .from(emailAccounts)
      .where(and(eq(emailAccounts.id, id), eq(emailAccounts.companyId, companyId)))
      .limit(1)

    if (!account) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 })
    }

    // Delete secrets first (cascade should handle this, but be explicit)
    await db
      .delete(emailAccountSecrets)
      .where(eq(emailAccountSecrets.emailAccountId, id))

    await db
      .delete(emailAccounts)
      .where(eq(emailAccounts.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const PATCH = withApiMiddleware(_PATCH, { csrfProtection: true })
export const DELETE = withApiMiddleware(_DELETE, { csrfProtection: true })
