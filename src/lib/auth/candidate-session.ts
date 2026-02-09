import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.ENCRYPTION_KEY || 'fallback-secret-key'
)

export interface CandidateSession {
  candidateId: string
  email: string
  type: 'candidate'
}

/**
 * Get the current candidate user session from the JWT cookie (server-side only)
 */
export async function getCandidateSession(): Promise<CandidateSession | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('candidate_session_token')?.value

    if (!token) {
      return null
    }

    const { payload } = await jwtVerify(token, JWT_SECRET)

    if (payload.type !== 'candidate') {
      return null
    }

    return {
      candidateId: payload.candidateId as string,
      email: payload.email as string,
      type: 'candidate',
    }
  } catch (error) {
    console.error('Failed to verify candidate session:', error)
    return null
  }
}
