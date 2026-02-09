import { db } from '@/lib/db'
import { candidateUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getCandidateSession } from './candidate-session'

export interface CandidateUser {
  id: string
  firstName: string
  lastName: string
  email: string
  profileImageUrl: string | null
  phone: string | null
  location: string | null
  currentTitle: string | null
  currentCompany: string | null
  linkedinUrl: string | null
  resumeUrl: string | null
  bio: string | null
  skills: string[] | null
  experienceYears: number | null
  emailVerified: boolean
  createdAt: Date
}

/**
 * Get the current logged-in candidate user (server-side only)
 */
export async function getCandidateUser(): Promise<CandidateUser | null> {
  try {
    const session = await getCandidateSession()

    if (!session) {
      return null
    }

    const [user] = await db.select()
      .from(candidateUsers)
      .where(eq(candidateUsers.id, session.candidateId))
      .limit(1)

    if (!user) {
      return null
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profileImageUrl: user.profileImageUrl,
      phone: user.phone,
      location: user.location,
      currentTitle: user.currentTitle,
      currentCompany: user.currentCompany,
      linkedinUrl: user.linkedinUrl,
      resumeUrl: user.resumeUrl,
      bio: user.bio,
      skills: user.skills,
      experienceYears: user.experienceYears,
      emailVerified: user.emailVerified ?? false,
      createdAt: user.createdAt,
    }
  } catch (error) {
    console.error('Failed to get candidate user:', error)
    return null
  }
}
