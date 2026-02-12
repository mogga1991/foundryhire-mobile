import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { createLogger } from '@/lib/logger'

const logger = createLogger('lib:auth:candidate-session')
import { env } from '@/lib/env'

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
    if (!env.JWT_SECRET) {
      logger.warn({ message: 'JWT_SECRET missing; candidate session verification disabled' })
      return null
    }

    const cookieStore = await cookies()
    const token = cookieStore.get('candidate_session_token')?.value

    if (!token) {
      return null
    }

    const jwtSecret = new TextEncoder().encode(env.JWT_SECRET)
    const { payload } = await jwtVerify(token, jwtSecret)

    if (payload.type !== 'candidate') {
      return null
    }

    return {
      candidateId: payload.candidateId as string,
      email: payload.email as string,
      type: 'candidate',
    }
  } catch (error) {
    logger.error({ message: 'Failed to verify candidate session', error })
    return null
  }
}
