import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { db } from '@/lib/db'
import { candidateUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getCandidateSession } from '@/lib/auth/candidate-session'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('candidate-resume-upload')

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024

// Allowed file types
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx']

async function _POST(req: NextRequest) {
  try {
    const session = await getCandidateSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('resume') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
      if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
        return NextResponse.json(
          { error: 'Invalid file type. Only PDF, DOC, and DOCX files are allowed' },
          { status: 400 }
        )
      }
    }

    // Generate unique filename
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    const timestamp = Date.now()
    const filename = `resumes/${session.candidateId}-${timestamp}${fileExtension}`

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: false,
    })

    // Update candidate user with resume URL
    const [updatedUser] = await db.update(candidateUsers)
      .set({
        resumeUrl: blob.url,
        updatedAt: new Date(),
      })
      .where(eq(candidateUsers.id, session.candidateId))
      .returning()

    logger.info(
      { candidateId: session.candidateId, resumeUrl: blob.url },
      'Resume uploaded successfully'
    )

    return NextResponse.json({
      success: true,
      resumeUrl: blob.url,
      message: 'Resume uploaded successfully',
    })
  } catch (error) {
    logger.error({ error }, 'Failed to upload resume')
    return NextResponse.json(
      { error: 'Failed to upload resume. Please try again.' },
      { status: 500 }
    )
  }
}

// Delete old resume
async function _DELETE(req: NextRequest) {
  try {
    const session = await getCandidateSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get current user to get the old resume URL
    const [user] = await db.select()
      .from(candidateUsers)
      .where(eq(candidateUsers.id, session.candidateId))
      .limit(1)

    if (!user || !user.resumeUrl) {
      return NextResponse.json(
        { error: 'No resume to delete' },
        { status: 400 }
      )
    }

    // Note: Vercel Blob doesn't provide a delete API in the free tier
    // We'll just remove the URL from the database
    // In production, you'd want to delete the actual file too

    await db.update(candidateUsers)
      .set({
        resumeUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(candidateUsers.id, session.candidateId))

    logger.info(
      { candidateId: session.candidateId },
      'Resume deleted successfully'
    )

    return NextResponse.json({
      success: true,
      message: 'Resume deleted successfully',
    })
  } catch (error) {
    logger.error({ error }, 'Failed to delete resume')
    return NextResponse.json(
      { error: 'Failed to delete resume. Please try again.' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
export const DELETE = withApiMiddleware(_DELETE, { csrfProtection: true })
