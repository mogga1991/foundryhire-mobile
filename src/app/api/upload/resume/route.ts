import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { createLogger } from '@/lib/logger'

const logger = createLogger('resume-upload')

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx'] as const
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

async function _POST(request: NextRequest) {
  try {
    await requireAuth()

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const candidateId = formData.get('candidateId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!candidateId) {
      return NextResponse.json({ error: 'candidateId is required' }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      logger.info({
        message: 'File size exceeds limit',
        fileSize: file.size,
        maxSize: MAX_FILE_SIZE,
        candidateId,
      })
      return NextResponse.json({ error: 'File size must be under 10MB' }, { status: 400 })
    }

    // Validate MIME type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ]
    if (!allowedTypes.includes(file.type)) {
      logger.info({
        message: 'Invalid file type',
        fileType: file.type,
        fileName: file.name,
        candidateId,
      })
      return NextResponse.json({ error: 'Only PDF and Word documents are allowed' }, { status: 400 })
    }

    // Whitelist extensions strictly
    const ext = file.name.toLowerCase().split('.').pop()
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number])) {
      logger.info({
        message: 'Invalid file extension',
        extension: ext,
        fileName: file.name,
        candidateId,
      })
      return NextResponse.json({ error: 'Only PDF and Word documents are allowed' }, { status: 400 })
    }

    // Generate UUID filename for security
    const safeFilename = `${candidateId}-${randomUUID()}.${ext}`

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'resumes')
    await mkdir(uploadDir, { recursive: true })

    const filePath = path.join(uploadDir, safeFilename)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const url = `/uploads/resumes/${safeFilename}`

    logger.info({
      message: 'Resume uploaded successfully',
      candidateId,
      filename: safeFilename,
      fileSize: file.size,
    })

    return NextResponse.json({ url, success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error({ message: 'Resume upload error', error })
    const message = error instanceof Error ? error.message : 'Failed to upload resume'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
