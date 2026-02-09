import { db } from '../src/lib/db'
import { companies, companyUsers, subscriptions, users } from '../src/lib/db/schema'
import { hashPassword } from '../src/lib/auth'

async function createDemoSetup() {
  try {
    console.log('Creating demo user and company...\n')

    // Create user with hashed password
    const hashedPassword = await hashPassword('demo123456')

    const [user] = await db
      .insert(users)
      .values({
        name: 'George Mogga',
        email: 'georgemogga1@gmail.com',
        passwordHash: hashedPassword,
        emailVerified: new Date(),
      })
      .returning()

    console.log(`✅ User created: ${user.email}`)

    // Create company
    const [company] = await db
      .insert(companies)
      .values({
        name: 'TalentForge Demo',
        industrySector: 'Technology',
        companySize: '11-50',
        website: 'https://talentforge.com',
      })
      .returning()

    console.log(`✅ Company created: ${company.name}`)

    // Link user to company as admin
    await db.insert(companyUsers).values({
      companyId: company.id,
      userId: user.id,
      role: 'admin',
    })

    console.log('✅ User linked to company as admin')

    // Create starter subscription
    await db.insert(subscriptions).values({
      companyId: company.id,
      plan: 'starter',
      status: 'active',
      jobPostsLimit: 3,
      aiCreditsLimit: 100,
      aiCreditsUsed: 0,
    })

    console.log('✅ Starter subscription created')
    console.log('\n🎉 Setup complete!')
    console.log('\nLogin credentials:')
    console.log('  Email: georgemogga1@gmail.com')
    console.log('  Password: demo123456')
    console.log('\nRefresh your browser and log in to start creating jobs!')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

createDemoSetup()
