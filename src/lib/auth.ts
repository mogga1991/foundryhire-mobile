import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { users, sessions } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import crypto from 'crypto'
import { env } from '@/lib/env'

// =============================================================================
// Password Hashing (using Node.js crypto - no external deps)
// =============================================================================

const SALT_LENGTH = 16
const KEY_LENGTH = 64
const ITERATIONS = 100_000
const DIGEST = 'sha512'

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SALT_LENGTH).toString('hex')
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST, (err, derivedKey) => {
      if (err) reject(err)
      resolve(`${salt}:${derivedKey.toString('hex')}`)
    })
  })
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(':')
    if (!salt || !key) return resolve(false)
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST, (err, derivedKey) => {
      if (err) reject(err)
      resolve(derivedKey.toString('hex') === key)
    })
  })
}

// =============================================================================
// Session Management (database-backed, cookie-based)
// =============================================================================

const SESSION_COOKIE_NAME = 'session_token'
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SESSION_DURATION_MS)

  await db.insert(sessions).values({
    sessionToken: token,
    userId,
    expires,
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  })

  return token
}

export async function getSession(): Promise<{
  user: { id: string; email: string; name: string | null; image: string | null }
} | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) return null

  const [session] = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      expires: sessions.expires,
      userName: users.name,
      userEmail: users.email,
      userImage: users.image,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.sessionToken, token),
        gt(sessions.expires, new Date())
      )
    )
    .limit(1)

  if (!session) {
    // Cookie will expire naturally or be cleaned up on next login
    return null
  }

  return {
    user: {
      id: session.userId,
      email: session.userEmail,
      name: session.userName,
      image: session.userImage,
    },
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    await db.delete(sessions).where(eq(sessions.sessionToken, token))
    cookieStore.delete(SESSION_COOKIE_NAME)
  }
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE_NAME)?.value
}
