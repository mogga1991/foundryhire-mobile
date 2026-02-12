import { db } from '@/lib/db'
import { candidateUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createLogger } from '@/lib/logger'

const logger = createLogger('lib:auth:candidate-session')
import type { User as SupabaseUser } from '@supabase/supabase-js'

export interface CandidateSession {
  candidateId: string
  email: string
  type: 'candidate'
  supabaseUserId: string
}

function deriveNames(authUser: SupabaseUser, email: string): {
  firstName: string
  lastName: string
} {
  const firstFromMeta =
    (authUser.user_metadata?.first_name as string | undefined)?.trim() ||
    (authUser.user_metadata?.given_name as string | undefined)?.trim()
  const lastFromMeta =
    (authUser.user_metadata?.last_name as string | undefined)?.trim() ||
    (authUser.user_metadata?.family_name as string | undefined)?.trim()
  const fullName =
    (authUser.user_metadata?.full_name as string | undefined)?.trim() ||
    (authUser.user_metadata?.name as string | undefined)?.trim()

  if (firstFromMeta || lastFromMeta) {
    return {
      firstName: firstFromMeta || 'Candidate',
      lastName: lastFromMeta || '',
    }
  }

  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean)
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' }
    }
    return {
      firstName: parts.slice(0, -1).join(' '),
      lastName: parts.slice(-1).join(' '),
    }
  }

  return {
    firstName: email.split('@')[0] || 'Candidate',
    lastName: '',
  }
}

export async function syncCandidateUserFromSupabaseUser(authUser: SupabaseUser): Promise<{
  id: string
  email: string
} | null> {
  const email = authUser.email?.toLowerCase().trim()
  if (!email) {
    return null
  }

  const names = deriveNames(authUser, email)
  const emailVerified = Boolean(authUser.email_confirmed_at)
  const isCandidateRole = authUser.user_metadata?.role === 'candidate'

  const [existingById] = await db
    .select({ id: candidateUsers.id, email: candidateUsers.email })
    .from(candidateUsers)
    .where(eq(candidateUsers.id, authUser.id))
    .limit(1)

  if (existingById) {
    await db
      .update(candidateUsers)
      .set({
        email,
        firstName: names.firstName,
        lastName: names.lastName,
        emailVerified,
        updatedAt: new Date(),
      })
      .where(eq(candidateUsers.id, existingById.id))
    return {
      id: existingById.id,
      email,
    }
  }

  const [existingByEmail] = await db
    .select({ id: candidateUsers.id, email: candidateUsers.email })
    .from(candidateUsers)
    .where(eq(candidateUsers.email, email))
    .limit(1)

  if (existingByEmail) {
    await db
      .update(candidateUsers)
      .set({
        firstName: names.firstName,
        lastName: names.lastName,
        emailVerified,
        updatedAt: new Date(),
      })
      .where(eq(candidateUsers.id, existingByEmail.id))
    return {
      id: existingByEmail.id,
      email,
    }
  }

  if (!isCandidateRole) {
    return null
  }

  await db.insert(candidateUsers).values({
    id: authUser.id,
    firstName: names.firstName,
    lastName: names.lastName,
    email,
    passwordHash: 'SUPABASE_MANAGED',
    emailVerified,
  })

  return {
    id: authUser.id,
    email,
  }
}

/**
 * Get the current candidate user session from Supabase auth (server-side only).
 */
export async function getCandidateSession(): Promise<CandidateSession | null> {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser()

    if (error || !authUser) {
      return null
    }

    const synced = await syncCandidateUserFromSupabaseUser(authUser)
    if (!synced) {
      return null
    }

    return {
      candidateId: synced.id,
      email: synced.email,
      type: 'candidate',
      supabaseUserId: authUser.id,
    }
  } catch (error) {
    logger.error({ message: 'Failed to verify candidate session', error })
    return null
  }
}
