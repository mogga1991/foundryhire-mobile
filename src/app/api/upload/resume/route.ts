import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
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

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only PDF and DOCX files are accepted' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be under 10MB' }, { status: 400 })
    }

    const fileExt = file.name.split('.').pop()
    const fileName = `${candidateId}-${Date.now()}.${fileExt}`

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'resumes')
    await mkdir(uploadDir, { recursive: true })

    const filePath = path.join(uploadDir, fileName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const url = `/uploads/resumes/${fileName}`

    return NextResponse.json({ url, success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Resume upload error:', error)
    const message = error instanceof Error ? error.message : 'Failed to upload resume'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
