import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { requireAuth } from '@/lib/auth-helpers'
import { writeFile, mkdir, readFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import mammoth from 'mammoth'

const logger = createLogger('api:upload:job-description')

async function _POST(request: NextRequest) {
  try {
    await requireAuth()

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Allow only DOCX files
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: 'Only DOCX files are accepted. Please convert .doc files to .docx format.',
      }, { status: 400 })
    }

    // 10MB file size limit
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be under 10MB' }, { status: 400 })
    }

    const fileExt = file.name.split('.').pop()
    const uniqueId = randomUUID()
    const fileName = `${uniqueId}-${Date.now()}.${fileExt}`

    // Create upload directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'job-descriptions')
    await mkdir(uploadDir, { recursive: true })

    // Write file to disk
    const filePath = path.join(uploadDir, fileName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const url = `/uploads/job-descriptions/${fileName}`

    // Extract text from DOCX file using mammoth
    let text: string
    try {
      const result = await mammoth.extractRawText({ path: filePath })
      text = result.value

      if (!text || text.trim().length < 50) {
        return NextResponse.json({
          error: 'Could not extract text from document. Please ensure the document contains text.',
          success: false,
        }, { status: 400 })
      }
    } catch (err) {
      logger.error({ message: 'Failed to extract text from DOCX', error: err })
      return NextResponse.json({
        error: 'Failed to extract text from document. Please try another file.',
        success: false,
      }, { status: 500 })
    }

    return NextResponse.json({
      url,
      text,
      success: true,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error({ message: 'Job description upload error', error })
    const message = error instanceof Error ? error.message : 'Failed to upload job description'
    return NextResponse.json({ error: message, success: false }, { status: 500 })
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
