import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { writeFile, mkdir, readFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'
import { generateJSON } from '@/lib/ai/mistral'
import {
  buildParseJobDescriptionPrompt,
  type ParseJobDescriptionResult,
} from '@/lib/ai/prompts/parse-job-description'

const logger = createLogger('api:jobs:parse')

// Types for better error handling
type FileProcessingError = {
  stage: 'upload' | 'extraction' | 'parsing'
  message: string
}

// Helper function to extract text from different file types
async function extractTextFromFile(file: File, filePath: string): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    switch (file.type) {
      case 'text/plain':
        return buffer.toString('utf-8')

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        // DOCX
        const docxResult = await mammoth.extractRawText({ buffer })
        return docxResult.value

      case 'application/msword':
        // DOC - mammoth can handle some DOC files
        try {
          const docResult = await mammoth.extractRawText({ buffer })
          return docResult.value
        } catch {
          throw new Error('Unable to parse .doc file. Please convert to .docx or .pdf format.')
        }

      case 'application/pdf':
        const parser = new PDFParse(buffer)
        const pdfData = await parser.parse()
        return pdfData.pages.map(page => page.text).join('\n')

      default:
        throw new Error(`Unsupported file type: ${file.type}`)
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Text extraction failed: ${error.message}`)
    }
    throw new Error('Text extraction failed: Unknown error')
  }
}

async function _POST(request: NextRequest) {
  let uploadedFilePath: string | null = null

  try {
    // Require authentication and company access
    await requireCompanyAccess()

    // Parse the form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        {
          error: 'No file provided',
          stage: 'upload'
        },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error: 'Invalid file type. Only PDF, DOC, DOCX, and TXT files are accepted.',
          stage: 'upload',
        },
        { status: 400 }
      )
    }

    // Validate file size (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'File size exceeds 10MB limit.',
          stage: 'upload',
        },
        { status: 400 }
      )
    }

    // Create upload directory
    const fileExt = file.name.split('.').pop()
    const uniqueId = randomUUID()
    const fileName = `${uniqueId}-${Date.now()}.${fileExt}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'job-descriptions')

    await mkdir(uploadDir, { recursive: true })

    // Save file to disk
    const filePath = path.join(uploadDir, fileName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)
    uploadedFilePath = filePath

    const fileUrl = `/uploads/job-descriptions/${fileName}`

    // Extract text from the uploaded file
    let extractedText: string
    try {
      extractedText = await extractTextFromFile(file, filePath)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to extract text from file'
      return NextResponse.json(
        {
          error: errorMessage,
          stage: 'extraction',
          fileUrl,
        },
        { status: 422 }
      )
    }

    // Validate extracted text
    if (!extractedText || extractedText.trim().length < 50) {
      return NextResponse.json(
        {
          error: 'Extracted text is too short (minimum 50 characters). The file may be empty or unreadable.',
          stage: 'extraction',
          fileUrl,
          extractedText: extractedText.substring(0, 200), // Return preview
        },
        { status: 422 }
      )
    }

    // Parse the extracted text using Claude AI
    let parsedData: ParseJobDescriptionResult
    try {
      const prompt = buildParseJobDescriptionPrompt(extractedText)
      parsedData = await generateJSON<ParseJobDescriptionResult>(prompt)

      // Validate AI response
      if (!parsedData.confidence || typeof parsedData.confidence.overall !== 'number') {
        throw new Error('AI failed to provide confidence scores')
      }

      // Normalize confidence score
      parsedData.confidence.overall = Math.max(0, Math.min(100, parsedData.confidence.overall))

      // Ensure missingFields is an array
      if (!Array.isArray(parsedData.missingFields)) {
        parsedData.missingFields = []
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse job description with AI'
      return NextResponse.json(
        {
          error: errorMessage,
          stage: 'parsing',
          fileUrl,
          extractedText: extractedText.substring(0, 500), // Return preview for debugging
        },
        { status: 500 }
      )
    }

    // Return successful response with parsed data
    return NextResponse.json({
      success: true,
      data: {
        ...parsedData,
        fileUrl,
        fileName: file.name,
        extractedText: extractedText.substring(0, 1000), // Include preview for verification
      },
    })

  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          stage: 'upload'
        },
        { status: 401 }
      )
    }

    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json(
        {
          error: 'No company set up. Please create your company in Settings first.',
          stage: 'upload',
        },
        { status: 400 }
      )
    }

    // Generic error handler
    logger.error({ message: 'Job document parse error', error })
    const message = error instanceof Error ? error.message : 'Failed to process job document'

    return NextResponse.json(
      {
        error: message,
        stage: 'upload',
      },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
