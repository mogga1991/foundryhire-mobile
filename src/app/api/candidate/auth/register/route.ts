import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { candidateUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

const logger = createLogger('candidate-auth-register')

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(req, RateLimitPresets.strict)
    if (rateLimitResult) {
      return rateLimitResult
    }

    const body = await req.json()
    const validatedData = registerSchema.parse(body)

    // Check if email already exists
    const existingUser = await db.select()
      .from(candidateUsers)
      .where(eq(candidateUsers.email, validatedData.email.toLowerCase()))
      .limit(1)

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validatedData.password, 12)

    // Create candidate user
    const [newUser] = await db.insert(candidateUsers).values({
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      email: validatedData.email.toLowerCase(),
      passwordHash,
      emailVerified: false,
    }).returning()

    logger.info({ candidateId: newUser.id, email: newUser.email }, 'Candidate user registered successfully')

    // Return success (without password hash)
    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
      },
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    logger.error({ error }, 'Candidate registration failed')
    return NextResponse.json(
      { error: 'Server error. Please try again or contact support.' },
      { status: 500 }
    )
  }
}
