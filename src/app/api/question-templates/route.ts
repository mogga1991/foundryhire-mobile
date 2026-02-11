import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { companyUsers, questionTemplates } from '@/lib/db/schema'
import { eq, and, ilike } from 'drizzle-orm'
import { z } from 'zod'
import { escapeLikePattern } from '@/lib/utils/sql-escape'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:question-templates')

const questionTemplateSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  category: z.enum(['behavioral', 'technical', 'situational', 'culture_fit', 'problem_solving']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  targetCompetency: z.string().min(1, 'Target competency is required'),
  expectedDuration: z.number().min(1).max(60), // minutes
  evaluationCriteria: z.string().min(1, 'Evaluation criteria is required'),
  sampleAnswer: z.string().optional(),
  jobId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).default([]),
})

export type QuestionTemplate = z.infer<typeof questionTemplateSchema> & {
  id: string
  createdAt: string
}

// GET - List all question templates for the company
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get company for this user
    const [companyUser] = await db
      .select({ companyId: companyUsers.companyId })
      .from(companyUsers)
      .where(eq(companyUsers.userId, session.user.id))
      .limit(1)

    if (!companyUser) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    // Parse query params for filtering
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const competency = searchParams.get('competency')
    const search = searchParams.get('search')

    // Build query conditions
    const conditions = [eq(questionTemplates.companyId, companyUser.companyId)]

    if (category) {
      conditions.push(eq(questionTemplates.category, category))
    }

    if (competency) {
      conditions.push(ilike(questionTemplates.targetCompetency, `%${escapeLikePattern(competency)}%`))
    }

    // Fetch templates from database
    let templates = await db
      .select()
      .from(questionTemplates)
      .where(and(...conditions))

    // Apply search filter (search in question text or tags)
    if (search) {
      const searchLower = search.toLowerCase()
      templates = templates.filter(t =>
        t.question.toLowerCase().includes(searchLower) ||
        (Array.isArray(t.tags) && t.tags.some((tag: string) => tag.toLowerCase().includes(searchLower)))
      )
    }

    return NextResponse.json({ templates })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({
      message: 'Error fetching question templates',
      error,
    })
    return NextResponse.json(
      { error: 'Failed to fetch question templates' },
      { status: 500 }
    )
  }
}

// POST - Create a new question template
async function _POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get company for this user
    const [companyUser] = await db
      .select({ companyId: companyUsers.companyId })
      .from(companyUsers)
      .where(eq(companyUsers.userId, session.user.id))
      .limit(1)

    if (!companyUser) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    const body = await req.json()
    const validatedData = questionTemplateSchema.parse(body)

    // Insert into database
    const [newTemplate] = await db
      .insert(questionTemplates)
      .values({
        companyId: companyUser.companyId,
        question: validatedData.question,
        category: validatedData.category,
        difficulty: validatedData.difficulty,
        targetCompetency: validatedData.targetCompetency,
        expectedDuration: validatedData.expectedDuration,
        evaluationCriteria: validatedData.evaluationCriteria,
        sampleAnswer: validatedData.sampleAnswer,
        jobId: validatedData.jobId ?? null,
        tags: validatedData.tags,
      })
      .returning()

    return NextResponse.json({ template: newTemplate }, { status: 201 })
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
    logger.error({
      message: 'Error creating question template',
      error,
    })
    return NextResponse.json(
      { error: 'Failed to create question template' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
