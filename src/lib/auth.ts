import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { User as SupabaseUser } from '@supabase/supabase-js'

const logger = createLogger('auth')

const LEGACY_CONFLICT_ERROR =
  'This account exists in a legacy auth format. Run a user migration to Supabase IDs before signing in.'

export function getLegacyAuthConflictErrorMessage(): string {
  return LEGACY_CONFLICT_ERROR
}

export async function syncSupabaseUser(authUser: SupabaseUser): Promise<{
  user: { id: string; email: string; name: string | null }
  error?: undefined
} | {
  user?: undefined
  error: string
}> {
  const email = authUser.email?.toLowerCase().trim()

  if (!email) {
    return { error: 'Authenticated user is missing an email address' }
  }

  const displayName =
    (authUser.user_metadata?.full_name as string | undefined) ??
    (authUser.user_metadata?.name as string | undefined) ??
    email

  const [existingByEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existingByEmail && existingByEmail.id !== authUser.id) {
    return { error: LEGACY_CONFLICT_ERROR }
  }

  await db
    .insert(users)
    .values({
      id: authUser.id,
      email,
      name: displayName,
      emailVerified: new Date(),
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email,
        name: displayName,
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    })

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1)

  return {
    user: {
      id: authUser.id,
      email: user?.email ?? email,
      name: user?.name ?? displayName,
    },
  }
}

export async function getSession(): Promise<{
  user: { id: string; email: string; name: string | null; image: string | null }
} | null> {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser()

    if (error || !authUser) {
      return null
    }

    const [dbUser] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        image: users.image,
      })
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1)

    const fallbackName = (authUser.user_metadata?.full_name as string | undefined) ?? null
    const fallbackImage = (authUser.user_metadata?.avatar_url as string | undefined) ?? null
    const email = dbUser?.email ?? authUser.email

    if (!email) {
      return null
    }

    return {
      user: {
        id: authUser.id,
        email,
        name: dbUser?.name ?? fallbackName,
        image: dbUser?.image ?? fallbackImage,
      },
    }
  } catch (error) {
    logger.error({ error }, 'Failed to load employer session')
    return null
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('session_token')

  try {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.signOut()
  } catch (error) {
    logger.error({ error }, 'Failed to sign out from Supabase')
  }
}

export async function getSessionToken(): Promise<string | undefined> {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token
  } catch {
    return undefined
  }
}
