/**
 * Database Seed Script
 *
 * Populates a fresh database with demo data for development and testing.
 *
 * Usage:
 *   npm run seed
 */

import { db } from '../src/lib/db'
import {
  companies,
  users,
  companyUsers,
  jobs,
  candidates,
  interviews,
  campaigns,
  subscriptions,
} from '../src/lib/db/schema'
import { hashPassword } from '../src/lib/auth'
import { eq } from 'drizzle-orm'

async function main() {
  console.log('Starting database seed...')

  try {
    // =========================================================================
    // 1. Create Company
    // =========================================================================
    console.log('Creating company...')

    const [company] = await db
      .insert(companies)
      .values({
        name: 'VerticalHire Demo Corp',
        industrySector: 'Construction',
        companySize: '50-200',
        website: 'https://verticalhire-demo.com',
      })
      .onConflictDoNothing()
      .returning()

    if (!company) {
      console.log('Company already exists, fetching...')
      const [existingCompany] = await db
        .select()
        .from(companies)
        .where(eq(companies.name, 'VerticalHire Demo Corp'))
        .limit(1)

      if (!existingCompany) {
        throw new Error('Failed to create or fetch company')
      }

      console.log(`Using existing company: ${existingCompany.id}`)
      await seedWithExistingCompany(existingCompany.id)
      return
    }

    console.log(`Created company: ${company.name} (${company.id})`)

    // =========================================================================
    // 2. Create Subscription
    // =========================================================================
    console.log('Creating subscription...')

    await db.insert(subscriptions).values({
      companyId: company.id,
      plan: 'professional',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      jobPostsLimit: 50,
      aiCreditsLimit: 1000,
      aiCreditsUsed: 250,
    })

    console.log('Subscription created')

    // =========================================================================
    // 3. Create Users
    // =========================================================================
    console.log('Creating users...')

    const adminPassword = await hashPassword('Admin123!')
    const recruiterPassword = await hashPassword('Recruiter123!')

    const [adminUser] = await db
      .insert(users)
      .values({
        name: 'Admin User',
        email: 'admin@verticalhire-demo.com',
        emailVerified: new Date(),
        passwordHash: adminPassword,
      })
      .returning()

    const [recruiterUser] = await db
      .insert(users)
      .values({
        name: 'Recruiter User',
        email: 'recruiter@verticalhire-demo.com',
        emailVerified: new Date(),
        passwordHash: recruiterPassword,
      })
      .returning()

    console.log(`Created users: ${adminUser.email}, ${recruiterUser.email}`)

    // Link users to company
    await db.insert(companyUsers).values([
      {
        companyId: company.id,
        userId: adminUser.id,
        role: 'admin',
      },
      {
        companyId: company.id,
        userId: recruiterUser.id,
        role: 'recruiter',
      },
    ])

    console.log('Users linked to company')

    // =========================================================================
    // 4. Create Jobs
    // =========================================================================
    console.log('Creating job postings...')

    const jobsData = [
      {
        companyId: company.id,
        title: 'Senior Project Manager',
        department: 'Construction Management',
        location: 'New York, NY',
        employmentType: 'full-time',
        experienceLevel: 'senior',
        salaryMin: 90000,
        salaryMax: 130000,
        salaryCurrency: 'USD',
        description: 'Lead major construction projects from inception to completion. Oversee teams, manage budgets, and ensure quality delivery.',
        requirements: [
          '8+ years of construction project management experience',
          'PMP certification preferred',
          'Strong leadership and communication skills',
          'Experience with commercial construction projects',
        ],
        responsibilities: [
          'Oversee all aspects of construction projects',
          'Manage project budgets and timelines',
          'Coordinate with subcontractors and suppliers',
          'Ensure compliance with safety regulations',
        ],
        benefits: ['Health insurance', '401(k) matching', 'Paid time off', 'Professional development'],
        skillsRequired: ['Project Management', 'Construction', 'Budgeting', 'Leadership'],
        skillsPreferred: ['AutoCAD', 'Procore', 'MS Project'],
        status: 'active',
        publishedAt: new Date(),
        createdBy: adminUser.id,
      },
      {
        companyId: company.id,
        title: 'Site Superintendent',
        department: 'Field Operations',
        location: 'Brooklyn, NY',
        employmentType: 'full-time',
        experienceLevel: 'mid',
        salaryMin: 70000,
        salaryMax: 95000,
        salaryCurrency: 'USD',
        description: 'Manage day-to-day operations on construction sites. Ensure safety, quality, and schedule adherence.',
        requirements: [
          '5+ years of construction site supervision',
          'OSHA 30 certification',
          'Strong problem-solving skills',
          'Ability to read blueprints',
        ],
        responsibilities: [
          'Supervise daily site operations',
          'Coordinate with subcontractors',
          'Enforce safety protocols',
          'Report progress to project managers',
        ],
        benefits: ['Health insurance', 'Retirement plan', 'Company vehicle'],
        skillsRequired: ['Construction', 'Safety Management', 'Blueprint Reading', 'Team Leadership'],
        skillsPreferred: ['LEED certification', 'Heavy equipment operation'],
        status: 'active',
        publishedAt: new Date(),
        createdBy: adminUser.id,
      },
      {
        companyId: company.id,
        title: 'Electrical Foreman',
        department: 'Electrical',
        location: 'Queens, NY',
        employmentType: 'full-time',
        experienceLevel: 'mid',
        salaryMin: 65000,
        salaryMax: 85000,
        salaryCurrency: 'USD',
        description: 'Lead electrical installation teams on commercial construction projects.',
        requirements: [
          'Valid electrical license',
          '5+ years electrical experience',
          'Experience leading teams',
          'Commercial construction background',
        ],
        responsibilities: [
          'Supervise electrical crew',
          'Install electrical systems per code',
          'Troubleshoot electrical issues',
          'Ensure quality and safety',
        ],
        benefits: ['Health insurance', 'Overtime pay', 'Tool allowance'],
        skillsRequired: ['Electrical', 'NEC Code', 'Commercial Wiring', 'Team Leadership'],
        skillsPreferred: ['Fire alarm systems', 'BAS systems'],
        status: 'active',
        publishedAt: new Date(),
        createdBy: recruiterUser.id,
      },
      {
        companyId: company.id,
        title: 'Safety Manager',
        department: 'Safety & Compliance',
        location: 'New York, NY',
        employmentType: 'full-time',
        experienceLevel: 'senior',
        salaryMin: 80000,
        salaryMax: 110000,
        salaryCurrency: 'USD',
        description: 'Develop and implement safety programs across all construction sites.',
        requirements: [
          'OSHA 30 required, OSHA 500 preferred',
          '7+ years construction safety experience',
          'Strong knowledge of OSHA regulations',
          'Excellent communication skills',
        ],
        responsibilities: [
          'Develop safety programs and policies',
          'Conduct site safety inspections',
          'Lead safety training sessions',
          'Investigate incidents and implement corrective actions',
        ],
        benefits: ['Comprehensive health coverage', '401(k) with match', 'Professional development', 'Company car'],
        skillsRequired: ['OSHA Compliance', 'Safety Training', 'Risk Assessment', 'Incident Investigation'],
        skillsPreferred: ['CSP certification', 'First Aid/CPR instructor'],
        status: 'active',
        publishedAt: new Date(),
        createdBy: adminUser.id,
      },
      {
        companyId: company.id,
        title: 'Carpenter - Formwork Specialist',
        department: 'Carpentry',
        location: 'Bronx, NY',
        employmentType: 'full-time',
        experienceLevel: 'entry',
        salaryMin: 45000,
        salaryMax: 60000,
        salaryCurrency: 'USD',
        description: 'Join our carpentry team specializing in concrete formwork for high-rise construction.',
        requirements: [
          '2+ years carpentry experience',
          'Formwork experience preferred',
          'Ability to read blueprints',
          'Physical fitness required',
        ],
        responsibilities: [
          'Build and install concrete forms',
          'Ensure proper alignment and bracing',
          'Strip and clean forms',
          'Maintain tools and equipment',
        ],
        benefits: ['Union membership', 'Health insurance', 'Pension plan', 'Paid training'],
        skillsRequired: ['Carpentry', 'Blueprint Reading', 'Concrete Forms', 'Measurement'],
        skillsPreferred: ['High-rise experience', 'Gang form systems'],
        status: 'draft',
        createdBy: recruiterUser.id,
      },
    ]

    const createdJobs = await db.insert(jobs).values(jobsData).returning()

    console.log(`Created ${createdJobs.length} job postings`)

    // =========================================================================
    // 5. Create Candidates
    // =========================================================================
    console.log('Creating candidates...')

    const candidatesData = [
      {
        companyId: company.id,
        jobId: createdJobs[0].id,
        firstName: 'John',
        lastName: 'Mitchell',
        email: 'john.mitchell@email.com',
        phone: '+1-555-0101',
        linkedinUrl: 'https://linkedin.com/in/john-mitchell-pm',
        currentTitle: 'Project Manager',
        currentCompany: 'BuildRight Construction',
        location: 'New York, NY',
        experienceYears: 10,
        skills: ['Project Management', 'Construction', 'Budgeting', 'Leadership', 'Scheduling'],
        status: 'active',
        stage: 'interview',
        aiScore: 92,
        appliedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        jobId: createdJobs[0].id,
        firstName: 'Sarah',
        lastName: 'Thompson',
        email: 'sarah.thompson@email.com',
        phone: '+1-555-0102',
        linkedinUrl: 'https://linkedin.com/in/sarah-thompson-pmp',
        currentTitle: 'Senior Project Manager',
        currentCompany: 'Metro Construction Group',
        location: 'Brooklyn, NY',
        experienceYears: 12,
        skills: ['PMP', 'Construction Management', 'Commercial Projects', 'AutoCAD'],
        status: 'active',
        stage: 'offer',
        aiScore: 95,
        appliedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        jobId: createdJobs[1].id,
        firstName: 'Mike',
        lastName: 'Rodriguez',
        email: 'mike.rodriguez@email.com',
        phone: '+1-555-0103',
        currentTitle: 'Site Supervisor',
        currentCompany: 'Skyline Builders',
        location: 'Queens, NY',
        experienceYears: 7,
        skills: ['Site Supervision', 'OSHA 30', 'Blueprint Reading', 'Scheduling'],
        status: 'active',
        stage: 'screening',
        aiScore: 88,
        appliedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        jobId: createdJobs[2].id,
        firstName: 'James',
        lastName: 'Wilson',
        email: 'james.wilson@email.com',
        phone: '+1-555-0104',
        currentTitle: 'Electrical Foreman',
        currentCompany: 'Empire Electric',
        location: 'Manhattan, NY',
        experienceYears: 8,
        skills: ['Electrical', 'NEC Code', 'Commercial Wiring', 'Team Leadership', 'Troubleshooting'],
        status: 'active',
        stage: 'applied',
        aiScore: 90,
        appliedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        jobId: createdJobs[3].id,
        firstName: 'Lisa',
        lastName: 'Chen',
        email: 'lisa.chen@email.com',
        phone: '+1-555-0105',
        linkedinUrl: 'https://linkedin.com/in/lisa-chen-safety',
        currentTitle: 'Safety Coordinator',
        currentCompany: 'Premier Construction',
        location: 'New York, NY',
        experienceYears: 9,
        skills: ['OSHA 30', 'Safety Training', 'Risk Assessment', 'Incident Investigation', 'OSHA 500'],
        status: 'active',
        stage: 'interview',
        aiScore: 91,
        appliedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        jobId: createdJobs[1].id,
        firstName: 'David',
        lastName: 'Brown',
        email: 'david.brown@email.com',
        phone: '+1-555-0106',
        currentTitle: 'Assistant Superintendent',
        currentCompany: 'Titan Construction',
        location: 'Bronx, NY',
        experienceYears: 4,
        skills: ['Construction', 'Site Management', 'Safety', 'Coordination'],
        status: 'active',
        stage: 'applied',
        aiScore: 82,
        appliedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        jobId: createdJobs[4].id,
        firstName: 'Carlos',
        lastName: 'Hernandez',
        email: 'carlos.hernandez@email.com',
        phone: '+1-555-0107',
        currentTitle: 'Carpenter',
        currentCompany: 'Precision Formwork',
        location: 'Queens, NY',
        experienceYears: 3,
        skills: ['Carpentry', 'Formwork', 'Blueprint Reading', 'Concrete'],
        status: 'active',
        stage: 'screening',
        aiScore: 78,
        appliedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        jobId: createdJobs[0].id,
        firstName: 'Emily',
        lastName: 'Davis',
        email: 'emily.davis@email.com',
        phone: '+1-555-0108',
        linkedinUrl: 'https://linkedin.com/in/emily-davis-pm',
        currentTitle: 'Project Engineer',
        currentCompany: 'Urban Developers',
        location: 'Manhattan, NY',
        experienceYears: 6,
        skills: ['Project Management', 'Engineering', 'Scheduling', 'Budgeting'],
        status: 'active',
        stage: 'rejected',
        aiScore: 75,
        appliedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        jobId: createdJobs[2].id,
        firstName: 'Robert',
        lastName: 'Taylor',
        email: 'robert.taylor@email.com',
        phone: '+1-555-0109',
        currentTitle: 'Journeyman Electrician',
        currentCompany: 'PowerTech Electric',
        location: 'Brooklyn, NY',
        experienceYears: 5,
        skills: ['Electrical', 'NEC Code', 'Troubleshooting', 'Installation'],
        status: 'active',
        stage: 'applied',
        aiScore: 85,
        appliedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        jobId: createdJobs[3].id,
        firstName: 'Jennifer',
        lastName: 'Martinez',
        email: 'jennifer.martinez@email.com',
        phone: '+1-555-0110',
        currentTitle: 'EHS Manager',
        currentCompany: 'SafeBuild Corp',
        location: 'New York, NY',
        experienceYears: 11,
        skills: ['OSHA Compliance', 'Safety Programs', 'Training', 'CSP Certified'],
        status: 'active',
        stage: 'applied',
        aiScore: 93,
        appliedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      },
    ]

    const createdCandidates = await db.insert(candidates).values(candidatesData).returning()

    console.log(`Created ${createdCandidates.length} candidates`)

    // =========================================================================
    // 6. Create Interviews
    // =========================================================================
    console.log('Creating interviews...')

    const interviewsData = [
      {
        companyId: company.id,
        candidateId: createdCandidates[0].id, // John Mitchell
        jobId: createdJobs[0].id,
        scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        durationMinutes: 60,
        interviewType: 'video',
        status: 'scheduled',
        scheduledBy: adminUser.id,
      },
      {
        companyId: company.id,
        candidateId: createdCandidates[1].id, // Sarah Thompson
        jobId: createdJobs[0].id,
        scheduledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        durationMinutes: 60,
        interviewType: 'video',
        status: 'completed',
        scheduledBy: adminUser.id,
        aiSummary: 'Excellent candidate with strong project management experience. Demonstrated leadership skills and technical knowledge. Highly recommended for the position.',
        aiSentimentScore: 95,
        aiCompetencyScores: {
          technical: 92,
          communication: 96,
          safety: 90,
          cultureFit: 95,
        },
      },
      {
        companyId: company.id,
        candidateId: createdCandidates[4].id, // Lisa Chen
        jobId: createdJobs[3].id,
        scheduledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        durationMinutes: 45,
        interviewType: 'phone',
        phoneNumber: '+1-555-0105',
        status: 'cancelled',
        cancelReason: 'Candidate requested reschedule',
        scheduledBy: recruiterUser.id,
      },
    ]

    const createdInterviews = await db.insert(interviews).values(interviewsData).returning()

    console.log(`Created ${createdInterviews.length} interviews`)

    // =========================================================================
    // 7. Create Campaigns
    // =========================================================================
    console.log('Creating campaigns...')

    const campaignsData = [
      {
        companyId: company.id,
        jobId: createdJobs[0].id,
        name: 'Senior PM Outreach Campaign',
        subject: 'Exciting Project Manager Opportunity at VerticalHire Demo',
        body: `Hi {{firstName}},

I came across your profile and was impressed by your experience in construction project management.

We have an exciting opportunity for a Senior Project Manager role at VerticalHire Demo Corp. This position offers:
- Competitive salary ($90k-$130k)
- Lead major commercial construction projects
- Great benefits and growth opportunities

Would you be interested in learning more?

Best regards,
{{senderName}}`,
        status: 'active',
        campaignType: 'outreach',
        totalRecipients: 15,
        totalSent: 15,
        totalOpened: 8,
        totalClicked: 3,
        totalReplied: 2,
        sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        createdBy: recruiterUser.id,
      },
      {
        companyId: company.id,
        jobId: createdJobs[2].id,
        name: 'Electrical Foreman Recruitment',
        subject: 'Lead Electrical Teams on Major NYC Projects',
        body: `Hi {{firstName}},

We're looking for experienced Electrical Foremen to join our growing team.

This role offers:
- $65k-$85k salary
- Work on high-profile commercial projects
- Lead your own crew
- Excellent benefits

Interested in discussing this opportunity?

Best,
{{senderName}}`,
        status: 'draft',
        campaignType: 'outreach',
        totalRecipients: 0,
        createdBy: recruiterUser.id,
      },
    ]

    const createdCampaigns = await db.insert(campaigns).values(campaignsData).returning()

    console.log(`Created ${createdCampaigns.length} campaigns`)

    // =========================================================================
    // Summary
    // =========================================================================
    console.log('\n✅ Database seeded successfully!')
    console.log('\n📊 Summary:')
    console.log(`   Company: ${company.name}`)
    console.log(`   Users: 2 (admin@verticalhire-demo.com, recruiter@verticalhire-demo.com)`)
    console.log(`   Jobs: ${createdJobs.length}`)
    console.log(`   Candidates: ${createdCandidates.length}`)
    console.log(`   Interviews: ${createdInterviews.length}`)
    console.log(`   Campaigns: ${createdCampaigns.length}`)
    console.log('\n🔑 Login credentials:')
    console.log('   Admin:     admin@verticalhire-demo.com / Admin123!')
    console.log('   Recruiter: recruiter@verticalhire-demo.com / Recruiter123!')
    console.log('\n')

    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding database:', error)
    process.exit(1)
  }
}

async function seedWithExistingCompany(companyId: string) {
  console.log('Company already exists. Skipping seed to avoid duplicates.')
  console.log('If you want to re-seed, please delete the existing data first.')
  process.exit(0)
}

// Run the seed function
main()
