import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { and, desc, eq } from 'drizzle-orm'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { getCandidateSession } from '@/lib/auth/candidate-session'
import { db } from '@/lib/db'
import { candidateDocuments } from '@/lib/db/schema'
import { createLogger } from '@/lib/logger'
import { generateDocumentInsights } from '@/lib/ai/document-insights'

const logger = createLogger('api:candidate:documents')

const MAX_FILE_SIZE = 8 * 1024 * 1024
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
]

const DEFAULT_REQUIRED_DOCUMENTS = [
  { type: 'resume', label: 'Resume', required: true },
  { type: 'work_auth', label: 'Work Authorization', required: true },
  { type: 'certification', label: 'Certification or License', required: false },
  { type: 'portfolio', label: 'Portfolio / Supporting Material', required: false },
]

export async function GET() {
  try {
    const session = await getCandidateSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const docs = await db
      .select()
      .from(candidateDocuments)
      .where(eq(candidateDocuments.candidateUserId, session.candidateId))
      .orderBy(desc(candidateDocuments.createdAt))

    return NextResponse.json({
      documents: docs,
      requiredChecklist: DEFAULT_REQUIRED_DOCUMENTS,
    })
  } catch (error) {
    logger.error({ message: 'Failed to fetch candidate documents', error })
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}

async function _POST(req: NextRequest) {
  try {
    const session = await getCandidateSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const documentType = String(formData.get('documentType') || '').trim() || 'additional'
    const companyId = String(formData.get('companyId') || '').trim() || null
    const candidateRecordId = String(formData.get('candidateRecordId') || '').trim() || null
    const interviewId = String(formData.get('interviewId') || '').trim() || null
    const required = String(formData.get('required') || 'false') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 8MB.' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 })
    }

    const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''
    const blobPath = `candidate-documents/${session.candidateId}/${Date.now()}-${documentType}${extension}`
    const blob = await put(blobPath, file, {
      access: 'public',
      addRandomSuffix: false,
    })

    const insightResult = generateDocumentInsights({
      documentType,
      fileName: file.name,
      fileSizeBytes: file.size,
    })

    const [inserted] = await db
      .insert(candidateDocuments)
      .values({
        candidateUserId: session.candidateId,
        companyId,
        candidateRecordId,
        interviewId,
        documentType,
        fileName: file.name,
        fileUrl: blob.url,
        fileMimeType: file.type,
        fileSizeBytes: file.size,
        required,
        score: insightResult.score,
        insights: { notes: insightResult.insights },
        status: 'under_review',
      })
      .returning()

    return NextResponse.json({
      success: true,
      document: inserted,
    })
  } catch (error) {
    logger.error({ message: 'Failed to upload candidate document', error })
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 })
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })

async function _DELETE(req: NextRequest) {
  try {
    const session = await getCandidateSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const documentId = url.searchParams.get('id')
    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
    }

    const deleted = await db
      .delete(candidateDocuments)
      .where(
        and(
          eq(candidateDocuments.id, documentId),
          eq(candidateDocuments.candidateUserId, session.candidateId)
        )
      )
      .returning({ id: candidateDocuments.id })

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ message: 'Failed to delete candidate document', error })
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}

export const DELETE = withApiMiddleware(_DELETE, { csrfProtection: true })
