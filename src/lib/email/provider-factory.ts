import { db } from '@/lib/db'
import { emailAccounts, emailAccountSecrets } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { decrypt } from '@/lib/utils/encryption'
import type { EmailProvider } from './types'
import { ResendProvider } from './providers/resend-provider'

export async function getEmailProvider(emailAccountId: string): Promise<EmailProvider> {
  const [account] = await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.id, emailAccountId))
    .limit(1)

  if (!account) throw new Error('Email account not found')
  if (account.status !== 'active') throw new Error(`Email account status: ${account.status}`)

  const [secret] = await db
    .select()
    .from(emailAccountSecrets)
    .where(eq(emailAccountSecrets.emailAccountId, emailAccountId))
    .limit(1)

  const decryptedData = secret ? JSON.parse(decrypt(secret.encryptedData)) : {}

  switch (account.type) {
    case 'esp':
      return new ResendProvider()

    case 'gmail_oauth': {
      const { GmailProvider } = await import('./providers/gmail-provider')
      return new GmailProvider({
        accessToken: decryptedData.accessToken,
        refreshToken: decryptedData.refreshToken,
        expiresAt: decryptedData.expiresAt,
        onTokenRefresh: async (newTokens) => {
          const updated = { ...decryptedData, ...newTokens }
          const { encrypt } = await import('@/lib/utils/encryption')
          await db
            .update(emailAccountSecrets)
            .set({
              encryptedData: encrypt(JSON.stringify(updated)),
              updatedAt: new Date(),
            })
            .where(eq(emailAccountSecrets.emailAccountId, emailAccountId))
        },
      })
    }

    case 'microsoft_oauth': {
      const { MicrosoftProvider } = await import('./providers/microsoft-provider')
      return new MicrosoftProvider({
        accessToken: decryptedData.accessToken,
        refreshToken: decryptedData.refreshToken,
        expiresAt: decryptedData.expiresAt,
        onTokenRefresh: async (newTokens) => {
          const updated = { ...decryptedData, ...newTokens }
          const { encrypt } = await import('@/lib/utils/encryption')
          await db
            .update(emailAccountSecrets)
            .set({
              encryptedData: encrypt(JSON.stringify(updated)),
              updatedAt: new Date(),
            })
            .where(eq(emailAccountSecrets.emailAccountId, emailAccountId))
        },
      })
    }

    case 'smtp': {
      const { SmtpProvider } = await import('./providers/smtp-provider')
      return new SmtpProvider({
        host: decryptedData.host,
        port: decryptedData.port,
        username: decryptedData.username,
        password: decryptedData.password,
        useTls: decryptedData.useTls ?? true,
      })
    }

    default:
      throw new Error(`Unknown provider type: ${account.type}`)
  }
}

export async function getDefaultProvider(companyId: string): Promise<{
  provider: EmailProvider
  emailAccountId: string
  fromAddress: string
  fromName: string | null
}> {
  // Try to find default email account
  const [defaultAccount] = await db
    .select()
    .from(emailAccounts)
    .where(and(
      eq(emailAccounts.companyId, companyId),
      eq(emailAccounts.isDefault, true),
      eq(emailAccounts.status, 'active')
    ))
    .limit(1)

  // Fall back to first active ESP account
  const account = defaultAccount ?? (await db
    .select()
    .from(emailAccounts)
    .where(and(
      eq(emailAccounts.companyId, companyId),
      eq(emailAccounts.type, 'esp'),
      eq(emailAccounts.status, 'active')
    ))
    .limit(1)
  )[0]

  // Fall back to first active account of any type
  const finalAccount = account ?? (await db
    .select()
    .from(emailAccounts)
    .where(and(
      eq(emailAccounts.companyId, companyId),
      eq(emailAccounts.status, 'active')
    ))
    .limit(1)
  )[0]

  if (!finalAccount) throw new Error('No active email account found for company')

  const provider = await getEmailProvider(finalAccount.id)
  return {
    provider,
    emailAccountId: finalAccount.id,
    fromAddress: finalAccount.fromAddress,
    fromName: finalAccount.fromName,
  }
}
