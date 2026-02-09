import { neon } from '@neondatabase/serverless'

async function dropAllTables() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found')
    process.exit(1)
  }

  console.log('🗑️  Dropping all existing tables...\n')

  const sql = neon(databaseUrl)

  try {
    // Get all table names using tagged template
    const tables = await sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `

    if (!tables || tables.length === 0) {
      console.log('No tables found to drop.\n')
      return
    }

    console.log(`Found ${tables.length} tables to drop:`)
    tables.forEach((row: any) => console.log(`  - ${row.tablename}`))
    console.log('')

    // Drop all tables one by one
    for (const row of tables) {
      await sql.query(`DROP TABLE IF EXISTS "${row.tablename}" CASCADE`)
    }

    console.log('✅ All tables dropped successfully!\n')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

dropAllTables()
