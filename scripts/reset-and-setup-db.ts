import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { join } from 'path'

async function resetAndSetupDatabase() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment')
    process.exit(1)
  }

  console.log('🔄 Resetting database and creating fresh schema...\n')

  const sql = neon(databaseUrl)

  try {
    // Read and execute the SQL file
    const sqlFile = readFileSync(join(__dirname, 'reset-db.sql'), 'utf-8')

    // Split by semicolons and execute each statement
    const statements = sqlFile
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && s !== '')

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      try {
        await sql.query(statement)
      } catch (err: any) {
        // Ignore errors for DROP statements (table might not exist)
        if (!statement.toUpperCase().includes('DROP')) {
          console.error(`Error at statement ${i + 1}:`, err.message)
          console.error('Statement:', statement.substring(0, 100) + '...')
        }
      }
    }

    console.log('✅ Database schema created successfully!\n')

    // Now create a demo user and company
    console.log('Creating demo user and company...\n')

    // Create or get user
    const [user] = await sql`
      INSERT INTO users (name, email, password_hash)
      VALUES ('George Mogga', 'georgemogga1@gmail.com', '$2a$10$demo.hash.placeholder')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, email
    `

    console.log(`✅ User: ${user.email}`)

    // Create company
    const [company] = await sql`
      INSERT INTO companies (name, industry_sector, company_size, website)
      VALUES ('TalentForge Demo', 'Technology', '11-50', 'https://talentforge.com')
      RETURNING id, name
    `

    console.log(`✅ Company: ${company.name}`)

    // Link user to company
    await sql`
      INSERT INTO company_users (company_id, user_id, role)
      VALUES (${company.id}, ${user.id}, 'admin')
      ON CONFLICT DO NOTHING
    `

    console.log('✅ User linked to company as admin')

    // Create subscription
    await sql`
      INSERT INTO subscriptions (company_id, plan, status, job_posts_limit, ai_credits_limit)
      VALUES (${company.id}, 'starter', 'active', 3, 100)
    `

    console.log('✅ Starter subscription created')

    console.log('\n🎉 Setup complete! Refresh your browser to see the jobs page.')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

resetAndSetupDatabase()
