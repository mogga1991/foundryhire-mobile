/**
 * List companies from the app (Neon) database so you can grab a company UUID
 * for lead pool imports into Supabase.
 *
 * Usage:
 *   npm run db:list-companies
 *
 * Env:
 *   DATABASE_URL (in .env.local)
 */

import path from 'node:path'
import dotenv from 'dotenv'
import { neon } from '@neondatabase/serverless'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL missing (set it in .env.local)')

  const sql = neon(databaseUrl)

  const rows = await sql`
    select id::text, name, created_at
    from companies
    order by created_at desc
    limit 50
  `

  if (!rows || rows.length === 0) {
    console.log('No companies found.')
    return
  }

  console.log('Companies (latest 50):')
  for (const r of rows as Array<{ id: string; name: string; created_at: string }>) {
    console.log(`${r.id}\t${r.name}\t${r.created_at}`)
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})

