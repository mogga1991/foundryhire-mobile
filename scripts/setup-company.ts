import { db } from '../src/lib/db'
import { companies, companyUsers, subscriptions, users } from '../src/lib/db/schema'
import { eq } from 'drizzle-orm'

async function setupCompany() {
  try {
    // Get the first user (you)
    const [user] = await db.select().from(users).limit(1)

    if (!user) {
      console.error('No user found. Please sign up first.')
      process.exit(1)
    }

    console.log(`Found user: ${user.email}`)

    // Check if user already has a company
    const [existingCompanyUser] = await db
      .select()
      .from(companyUsers)
      .where(eq(companyUsers.userId, user.id))
      .limit(1)

    if (existingCompanyUser) {
      console.log('✅ Company already set up!')
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, existingCompanyUser.companyId))
        .limit(1)
      console.log(`Company: ${company?.name}`)
      process.exit(0)
    }

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

    console.log(`✅ Created company: ${company.name}`)

    // Link user to company as admin
    await db.insert(companyUsers).values({
      companyId: company.id,
      userId: user.id,
      role: 'admin',
    })

    console.log('✅ Linked user to company as admin')

    // Create a starter subscription
    await db.insert(subscriptions).values({
      companyId: company.id,
      plan: 'starter',
      status: 'active',
      jobPostsLimit: 3,
      aiCreditsLimit: 100,
      aiCreditsUsed: 0,
    })

    console.log('✅ Created starter subscription')
    console.log('\n🎉 Company setup complete! Refresh your browser to see the jobs page.')

  } catch (error) {
    console.error('Error setting up company:', error)
    process.exit(1)
  }
}

setupCompany()
