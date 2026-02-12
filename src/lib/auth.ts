import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { auth, currentUser } from '@clerk/nextjs/server'

const logger = createLogger('auth')

const LEGACY_CONFLICT_ERROR =
  'This account exists in a legacy auth format. Run a user migration to Supabase IDs before signing in.'

const GUEST_SESSION = {
  user: {
    id: '00000000-0000-0000-0000-000000000000',
    email: 'guest@verticalhire.local',
    name: 'Guest',
    image: null,
  },
} as const

type SessionResult = {
  user: { id: string; email: string; name: string | null; image: string | null }
}

export type GetSessionOptions = {
  allowGuest?: boolean
}

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

export async function getSession(options: GetSessionOptions = {}): Promise<SessionResult | null> {
  const allowGuest = options.allowGuest ?? false

  try {
    // Prefer Clerk session if present.
    // We map Clerk user IDs to our local `users.id` UUID via `users.clerkUserId`.
    let clerkUserId: string | null = null
    try {
      const a = await auth()
      clerkUserId = a.userId ?? null
    } catch {
      // Clerk not configured or middleware not active; fall back to Supabase session.
      clerkUserId = null
    }

    if (clerkUserId) {
      let clerkUser: Awaited<ReturnType<typeof currentUser>> | null = null
      try {
        clerkUser = await currentUser()
      } catch {
        clerkUser = null
      }

      const email =
        clerkUser?.primaryEmailAddress?.emailAddress?.toLowerCase().trim() || null

      if (!email) {
        return null
      }

      const displayName =
        clerkUser?.fullName?.trim() ||
        clerkUser?.username?.trim() ||
        email

      const imageUrl = clerkUser?.imageUrl || null

      // 1) Try by Clerk user id
      const [existingByClerk] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          image: users.image,
        })
        .from(users)
        .where(eq(users.clerkUserId, clerkUserId))
        .limit(1)

      if (existingByClerk) {
        return {
          user: {
            id: existingByClerk.id,
            email: existingByClerk.email,
            name: existingByClerk.name,
            image: existingByClerk.image ?? imageUrl,
          },
        }
      }

      // 2) Link by email if user already exists (migration-friendly)
      const [existingByEmail] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          image: users.image,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1)

      if (existingByEmail) {
        await db
          .update(users)
          .set({
            clerkUserId,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingByEmail.id))

        return {
          user: {
            id: existingByEmail.id,
            email: existingByEmail.email,
            name: existingByEmail.name,
            image: existingByEmail.image ?? imageUrl,
          },
        }
      }

      // 3) Create a new local user
      const [created] = await db
        .insert(users)
        .values({
          email,
          name: displayName,
          image: imageUrl,
          emailVerified: new Date(),
          clerkUserId,
        })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          image: users.image,
        })

      if (!created) {
        return null
      }

      return {
        user: {
          id: created.id,
          email: created.email,
          name: created.name,
          image: created.image,
        },
      }
    }

    // Fallback to Supabase-based session (legacy).
    const supabase = await createSupabaseServerClient()
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser()

    if (error || !authUser) {
      return allowGuest ? GUEST_SESSION : null
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
    return allowGuest ? GUEST_SESSION : null
  }
}

export async function deleteSession(): Promise<void> {
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
