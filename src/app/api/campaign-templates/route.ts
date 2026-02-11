import { NextRequest, NextResponse } from 'next/server'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { z } from 'zod'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { campaignTemplates } from '@/lib/db/schema'
import { eq, or, desc } from 'drizzle-orm'

// Validation schema for creating a template
const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required').max(10000),
})

export async function GET() {
  try {
    const { companyId } = await requireCompanyAccess()

    const templates = await db
      .select()
      .from(campaignTemplates)
      .where(
        or(
          eq(campaignTemplates.companyId, companyId),
          eq(campaignTemplates.isSystem, true)
        )
      )
      .orderBy(desc(campaignTemplates.isSystem), desc(campaignTemplates.createdAt))

    return NextResponse.json({ templates })
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

async function _POST(request: NextRequest) {
  try {
    const { user, companyId } = await requireCompanyAccess()

    const body = await request.json()
    const result = createTemplateSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { name, subject, body: templateBody } = result.data

    const [template] = await db
      .insert(campaignTemplates)
      .values({
        companyId,
        name,
        subject,
        body: templateBody,
        isSystem: false,
        createdBy: user.id,
      })
      .returning()

    return NextResponse.json({ template }, { status: 201 })
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

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
