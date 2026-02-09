import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { candidateUsers } from '@/lib/db/schema'
import { sql, or, and, ilike, gte, lte } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'

const logger = createLogger('candidate-search')

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const location = searchParams.get('location') || ''
    const experience = searchParams.get('experience') || ''

    // Build query conditions
    const conditions = []

    // Text search across multiple fields
    if (query) {
      conditions.push(
        or(
          ilike(candidateUsers.firstName, `%${query}%`),
          ilike(candidateUsers.lastName, `%${query}%`),
          ilike(candidateUsers.currentTitle, `%${query}%`),
          ilike(candidateUsers.currentCompany, `%${query}%`),
          ilike(candidateUsers.bio, `%${query}%`),
          sql`EXISTS (
            SELECT 1 FROM unnest(${candidateUsers.skills}) AS skill
            WHERE LOWER(skill) LIKE LOWER(${`%${query}%`})
          )`
        )
      )
    }

    // Location filter
    if (location) {
      conditions.push(
        ilike(candidateUsers.location, `%${location}%`)
      )
    }

    // Experience filter
    if (experience && experience !== 'all') {
      switch (experience) {
        case '0-2':
          conditions.push(
            and(
              gte(candidateUsers.experienceYears, 0),
              lte(candidateUsers.experienceYears, 2)
            )
          )
          break
        case '3-5':
          conditions.push(
            and(
              gte(candidateUsers.experienceYears, 3),
              lte(candidateUsers.experienceYears, 5)
            )
          )
          break
        case '6-10':
          conditions.push(
            and(
              gte(candidateUsers.experienceYears, 6),
              lte(candidateUsers.experienceYears, 10)
            )
          )
          break
        case '10+':
          conditions.push(
            gte(candidateUsers.experienceYears, 10)
          )
          break
      }
    }

    // Execute search
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const results = await db.select({
      id: candidateUsers.id,
      firstName: candidateUsers.firstName,
      lastName: candidateUsers.lastName,
      email: candidateUsers.email,
      profileImageUrl: candidateUsers.profileImageUrl,
      location: candidateUsers.location,
      currentTitle: candidateUsers.currentTitle,
      currentCompany: candidateUsers.currentCompany,
      experienceYears: candidateUsers.experienceYears,
      skills: candidateUsers.skills,
      bio: candidateUsers.bio,
      resumeUrl: candidateUsers.resumeUrl,
      createdAt: candidateUsers.createdAt,
    })
      .from(candidateUsers)
      .where(whereClause)
      .orderBy(sql`${candidateUsers.createdAt} DESC`)
      .limit(50)

    logger.info(
      { query, location, experience, resultCount: results.length },
      'Candidate search executed'
    )

    return NextResponse.json({
      success: true,
      candidates: results,
      count: results.length,
    })
  } catch (error) {
    logger.error({ error }, 'Failed to search candidates')
    return NextResponse.json(
      { error: 'Failed to search candidates' },
      { status: 500 }
    )
  }
}
