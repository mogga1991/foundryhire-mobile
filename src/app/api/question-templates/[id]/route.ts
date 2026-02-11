import { NextRequest, NextResponse } from 'next/server'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { companyUsers, questionTemplates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:question-templates')

const questionTemplateUpdateSchema = z.object({
  question: z.string().min(1).optional(),
  category: z.enum(['behavioral', 'technical', 'situational', 'culture_fit', 'problem_solving']).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  targetCompetency: z.string().min(1).optional(),
  expectedDuration: z.number().min(1).max(60).optional(),
  evaluationCriteria: z.string().min(1).optional(),
  sampleAnswer: z.string().optional(),
  jobId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

// PATCH - Update a question template
async function _PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get company for this user
    const [companyUser] = await db
      .select({ companyId: companyUsers.companyId })
      .from(companyUsers)
      .where(eq(companyUsers.userId, session.user.id))
      .limit(1)

    if (!companyUser) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    // Verify the template exists and belongs to the company
    const [existing] = await db
      .select()
      .from(questionTemplates)
      .where(and(eq(questionTemplates.id, id), eq(questionTemplates.companyId, companyUser.companyId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Question template not found' }, { status: 404 })
    }

    const body = await req.json()
    const validatedData = questionTemplateUpdateSchema.parse(body)

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (validatedData.question !== undefined) updateData.question = validatedData.question
    if (validatedData.category !== undefined) updateData.category = validatedData.category
    if (validatedData.difficulty !== undefined) updateData.difficulty = validatedData.difficulty
    if (validatedData.targetCompetency !== undefined) updateData.targetCompetency = validatedData.targetCompetency
    if (validatedData.expectedDuration !== undefined) updateData.expectedDuration = validatedData.expectedDuration
    if (validatedData.evaluationCriteria !== undefined) updateData.evaluationCriteria = validatedData.evaluationCriteria
    if (validatedData.sampleAnswer !== undefined) updateData.sampleAnswer = validatedData.sampleAnswer
    if (validatedData.jobId !== undefined) updateData.jobId = validatedData.jobId
    if (validatedData.tags !== undefined) updateData.tags = validatedData.tags

    // Update in database
    const [updatedTemplate] = await db
      .update(questionTemplates)
      .set(updateData)
      .where(eq(questionTemplates.id, id))
      .returning()

    return NextResponse.json({ template: updatedTemplate })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    logger.error({ message: 'Error updating question template', error })
    return NextResponse.json(
      { error: 'Failed to update question template' },
      { status: 500 }
    )
  }
}

// DELETE - Remove a question template
async function _DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get company for this user
    const [companyUser] = await db
      .select({ companyId: companyUsers.companyId })
      .from(companyUsers)
      .where(eq(companyUsers.userId, session.user.id))
      .limit(1)

    if (!companyUser) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    // Verify the template exists and belongs to the company before deleting
    const [existing] = await db
      .select()
      .from(questionTemplates)
      .where(and(eq(questionTemplates.id, id), eq(questionTemplates.companyId, companyUser.companyId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Question template not found' }, { status: 404 })
    }

    // Delete from database
    await db
      .delete(questionTemplates)
      .where(eq(questionTemplates.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ message: 'Error deleting question template', error })
    return NextResponse.json(
      { error: 'Failed to delete question template' },
      { status: 500 }
    )
  }
}

export const PATCH = withApiMiddleware(_PATCH, { csrfProtection: true })
export const DELETE = withApiMiddleware(_DELETE, { csrfProtection: true })
