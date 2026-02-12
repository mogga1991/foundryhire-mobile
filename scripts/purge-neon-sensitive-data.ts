/**
 * Purge sensitive user/auth/email data from a Neon (Postgres) database.
 *
 * This is intended for dev/test databases and GDPR-style cleanups.
 *
 * By default it runs in DRY RUN mode and only prints row counts.
 *
 * Usage:
 *   npm run db:purge-sensitive -- --dry-run
 *   npm run db:purge-sensitive -- --execute --confirm "PURGE"
 *
 * Options:
 *   --database-url <url>     Override DATABASE_URL (otherwise uses env DATABASE_URL)
 *   --scope <all|auth|email|candidate_portal|team|notifications|gdpr>
 *   --dry-run               Default. Print counts only.
 *   --execute               Perform the purge (requires --confirm PURGE).
 *   --confirm PURGE         Safety confirmation string.
 *
 * Notes:
 * - We anonymize `users` and `candidate_users` (to preserve referential integrity),
 *   and delete/truncate token/queue tables.
 * - This does NOT touch `companies`, `jobs`, `candidates`, etc. unless those tables
 *   are covered by the selected scopes.
 */

import path from 'node:path'
import dotenv from 'dotenv'
import { neon } from '@neondatabase/serverless'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

function getArg(name: string): string | null {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return null
  return process.argv[idx + 1] ?? null
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

type Scope =
  | 'all'
  | 'auth'
  | 'email'
  | 'candidate_portal'
  | 'team'
  | 'notifications'
  | 'gdpr'

function parseScope(v: string | null): Scope {
  const s = (v || 'all').toLowerCase()
  if (
    s === 'all' ||
    s === 'auth' ||
    s === 'email' ||
    s === 'candidate_portal' ||
    s === 'team' ||
    s === 'notifications' ||
    s === 'gdpr'
  ) {
    return s
  }
  throw new Error(`Invalid --scope "${v}"`)
}

function scopesToTables(scope: Scope): {
  truncate: string[]
  anonymizeUsers: boolean
  anonymizeCandidateUsers: boolean
} {
  // Prefer TRUNCATE for pure-token/queue/log tables, and anonymize for user tables to keep FKs valid.
  const base = {
    truncate: [] as string[],
    anonymizeUsers: false,
    anonymizeCandidateUsers: false,
  }

  const add = (patch: Partial<typeof base>) => ({
    truncate: [...base.truncate, ...(patch.truncate || [])],
    anonymizeUsers: base.anonymizeUsers || !!patch.anonymizeUsers,
    anonymizeCandidateUsers: base.anonymizeCandidateUsers || !!patch.anonymizeCandidateUsers,
  })

  if (scope === 'all') {
    return {
      truncate: [
        // NextAuth tokens
        'accounts',
        'sessions',
        'verification_tokens',

        // Candidate portal auth + related artifacts
        'candidate_preferences',
        'candidate_documents',
        'candidate_onboarding_tasks',
        'candidate_reach_outs',

        // Email infra
        'email_queue',
        'email_suppressions',
        'domain_identities',
        'email_account_secrets',
        'email_accounts',

        // Reminder + system notifications
        'interview_reminders',
        'notifications',

        // Team management
        'team_invitations',
        'team_members',

        // GDPR logs (can contain PII in details)
        'gdpr_audit_log',
      ],
      anonymizeUsers: true,
      anonymizeCandidateUsers: true,
    }
  }

  if (scope === 'auth') {
    return add({
      truncate: ['accounts', 'sessions', 'verification_tokens'],
      anonymizeUsers: true,
    })
  }

  if (scope === 'candidate_portal') {
    return add({
      truncate: [
        'candidate_preferences',
        'candidate_documents',
        'candidate_onboarding_tasks',
        'candidate_reach_outs',
      ],
      anonymizeCandidateUsers: true,
    })
  }

  if (scope === 'email') {
    return add({
      truncate: [
        'email_queue',
        'email_suppressions',
        'domain_identities',
        'email_account_secrets',
        'email_accounts',
        'interview_reminders',
      ],
    })
  }

  if (scope === 'team') {
    return add({ truncate: ['team_invitations', 'team_members'] })
  }

  if (scope === 'notifications') {
    return add({ truncate: ['notifications'] })
  }

  if (scope === 'gdpr') {
    return add({ truncate: ['gdpr_audit_log'] })
  }

  return base
}

async function tableExists(sql: ReturnType<typeof neon>, tableName: string): Promise<boolean> {
  const rows = await sql`
    select to_regclass('public.' || ${tableName}) is not null as ok
  `
  return !!rows?.[0]?.ok
}

async function countRows(sql: ReturnType<typeof neon>, tableName: string): Promise<number | null> {
  const exists = await tableExists(sql, tableName)
  if (!exists) return null
  const rows = await sql.unsafe(`select count(*)::int as c from public.${tableName}`)
  return (rows?.[0]?.c as number | undefined) ?? 0
}

async function main() {
  const scope = parseScope(getArg('--scope'))
  const dryRun = hasFlag('--dry-run') || !hasFlag('--execute')
  const execute = hasFlag('--execute')
  const confirm = getArg('--confirm')

  if (execute && confirm !== 'PURGE') {
    throw new Error('Refusing to run. To execute, pass: --execute --confirm PURGE')
  }

  const databaseUrl = getArg('--database-url') || process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL missing (set it in .env.local or pass --database-url).')

  const sql = neon(databaseUrl)

  const ctxRows = await sql`select now() as server_time, current_database() as db, current_user as db_user`
  const ctx = ctxRows?.[0]
  console.log('Target DB:', ctx?.db, 'User:', ctx?.db_user, 'Server time:', ctx?.server_time)
  console.log('Scope:', scope)
  console.log('Mode:', dryRun ? 'DRY RUN' : 'EXECUTE')

  const plan = scopesToTables(scope)

  // Count before
  const tables = [
    ...(plan.anonymizeUsers ? ['users'] : []),
    ...(plan.anonymizeCandidateUsers ? ['candidate_users'] : []),
    ...plan.truncate,
  ]

  console.log('\nRow counts (before):')
  for (const t of tables) {
    const c = await countRows(sql, t)
    console.log(`${t}: ${c === null ? '(missing)' : c}`)
  }

  if (dryRun) {
    console.log('\nDry run only. Re-run with: --execute --confirm PURGE')
    return
  }

  await sql`begin`
  try {
    if (plan.anonymizeUsers && await tableExists(sql, 'users')) {
      // Preserve FKs by anonymizing rather than deleting.
      await sql.unsafe(`
        update public.users
        set
          email = 'deleted-' || replace(id::text, '-', '') || '@redacted.local',
          name = null,
          image = null,
          password_hash = null,
          email_verified = null,
          updated_at = now()
      `)
    }

    if (plan.anonymizeCandidateUsers && await tableExists(sql, 'candidate_users')) {
      await sql.unsafe(`
        update public.candidate_users
        set
          email = 'deleted-' || replace(id::text, '-', '') || '@redacted.local',
          first_name = 'Deleted',
          last_name = 'User',
          password_hash = 'DELETED',
          email_verified = false,
          verification_token = null,
          verification_token_expiry = null,
          reset_password_token = null,
          reset_password_expiry = null,
          profile_image_url = null,
          phone = null,
          location = null,
          current_title = null,
          current_company = null,
          linkedin_url = null,
          resume_url = null,
          bio = null,
          skills = null,
          experience_years = null,
          last_login_at = null,
          updated_at = now()
      `)
    }

    // Truncate/delete token and queue tables.
    // We do per-table TRUNCATE so missing tables don't fail the whole run.
    for (const t of plan.truncate) {
      if (!await tableExists(sql, t)) continue
      await sql.unsafe(`truncate table public.${t} restart identity cascade`)
    }

    await sql`commit`
  } catch (e) {
    await sql`rollback`
    throw e
  }

  console.log('\nRow counts (after):')
  for (const t of tables) {
    const c = await countRows(sql, t)
    console.log(`${t}: ${c === null ? '(missing)' : c}`)
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})

