import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { companyUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  }
}

export async function requireCompanyAccess() {
  const user = await requireAuth()

  const [companyUser] = await db
    .select()
    .from(companyUsers)
    .where(eq(companyUsers.userId, user.id))
    .limit(1)

  if (!companyUser) {
    throw new Error('No company found for user')
  }

  return {
    user,
    companyId: companyUser.companyId,
    role: companyUser.role,
  }
}

export async function requireAdminAccess() {
  const user = await requireAuth()

  const [companyUser] = await db
    .select({ companyId: companyUsers.companyId, role: companyUsers.role })
    .from(companyUsers)
    .where(eq(companyUsers.userId, user.id))
    .limit(1)

  if (!companyUser) {
    throw new Error('No company found for user')
  }

  if (companyUser.role !== 'admin') {
    throw new Error('Admin access required')
  }

  return {
    user,
    companyId: companyUser.companyId,
    role: companyUser.role,
  }
}
