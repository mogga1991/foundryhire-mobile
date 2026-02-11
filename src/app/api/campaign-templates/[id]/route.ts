import { NextRequest, NextResponse } from 'next/server'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { z } from 'zod'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { campaignTemplates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// Validation schema for updating a template
const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  subject: z.string().min(1).max(500).optional(),
  body: z.string().min(1).max(10000).optional(),
})

async function _PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { companyId } = await requireCompanyAccess()

    // Verify template exists and belongs to company
    const [existing] = await db
      .select()
      .from(campaignTemplates)
      .where(
        and(
          eq(campaignTemplates.id, id),
          eq(campaignTemplates.companyId, companyId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    if (existing.isSystem) {
      return NextResponse.json(
        { error: 'System templates cannot be modified' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const result = updateTemplateSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (result.data.name !== undefined) updateData.name = result.data.name
    if (result.data.subject !== undefined) updateData.subject = result.data.subject
    if (result.data.body !== undefined) updateData.body = result.data.body

    const [updated] = await db
      .update(campaignTemplates)
      .set(updateData)
      .where(eq(campaignTemplates.id, id))
      .returning()

    return NextResponse.json({ template: updated })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function _DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { companyId } = await requireCompanyAccess()

    // Verify template exists and belongs to company
    const [existing] = await db
      .select()
      .from(campaignTemplates)
      .where(
        and(
          eq(campaignTemplates.id, id),
          eq(campaignTemplates.companyId, companyId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    if (existing.isSystem) {
      return NextResponse.json(
        { error: 'System templates cannot be deleted' },
        { status: 403 }
      )
    }

    await db
      .delete(campaignTemplates)
      .where(eq(campaignTemplates.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const PATCH = withApiMiddleware(_PATCH, { csrfProtection: true })
export const DELETE = withApiMiddleware(_DELETE, { csrfProtection: true })
