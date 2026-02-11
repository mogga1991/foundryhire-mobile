import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { jobs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const logger = createLogger('api:sourcing:linkedin')

const MOCK_CONSTRUCTION_CANDIDATES = [
  {
    first_name: 'Marcus',
    last_name: 'Thompson',
    email: 'marcus.thompson@email.com',
    phone: '(713) 555-0142',
    linkedin_url: 'https://linkedin.com/in/marcus-thompson-pm',
    current_title: 'Senior Project Manager',
    current_company: 'Turner Construction',
    location: 'Houston, TX',
    experience_years: 12,
    skills: ['Project Management', 'Procore', 'Safety Management', 'OSHA 30', 'Scheduling', 'Cost Control', 'Commercial Construction'],
    match_score: 92,
    match_reasons: ['12 years PM experience', 'Procore proficiency', 'OSHA certified', 'Commercial construction background'],
    source: 'linkedin' as const,
    profile_url: 'https://linkedin.com/in/marcus-thompson-pm',
  },
  {
    first_name: 'Jennifer',
    last_name: 'Reeves',
    email: 'jennifer.reeves@email.com',
    phone: '(214) 555-0198',
    linkedin_url: 'https://linkedin.com/in/jennifer-reeves-construction',
    current_title: 'Construction Superintendent',
    current_company: 'Hensel Phelps',
    location: 'Dallas, TX',
    experience_years: 15,
    skills: ['Superintendence', 'Quality Control', 'BIM', 'Lean Construction', 'LEED AP', 'Team Leadership', 'Healthcare Construction'],
    match_score: 88,
    match_reasons: ['15 years experience', 'LEED AP certified', 'BIM expertise', 'Healthcare construction specialist'],
    source: 'linkedin' as const,
    profile_url: 'https://linkedin.com/in/jennifer-reeves-construction',
  },
  {
    first_name: 'David',
    last_name: 'Chen',
    email: 'david.chen@email.com',
    phone: '(512) 555-0167',
    linkedin_url: 'https://linkedin.com/in/david-chen-estimator',
    current_title: 'Chief Estimator',
    current_company: 'Skanska USA',
    location: 'Austin, TX',
    experience_years: 10,
    skills: ['Estimating', 'Bluebeam', 'Heavy Bid', 'RSMeans', 'Preconstruction', 'Value Engineering', 'Infrastructure'],
    match_score: 85,
    match_reasons: ['Chief Estimator experience', 'Bluebeam proficiency', 'Infrastructure background', 'Value engineering expertise'],
    source: 'linkedin' as const,
    profile_url: 'https://linkedin.com/in/david-chen-estimator',
  },
  {
    first_name: 'Sarah',
    last_name: 'Martinez',
    email: 'sarah.martinez@email.com',
    phone: '(210) 555-0123',
    linkedin_url: 'https://linkedin.com/in/sarah-martinez-safety',
    current_title: 'Director of Safety',
    current_company: 'McCarthy Building Companies',
    location: 'San Antonio, TX',
    experience_years: 18,
    skills: ['Safety Management', 'OSHA 510', 'CHST', 'Incident Investigation', 'Training Development', 'Risk Assessment', 'Industrial Construction'],
    match_score: 82,
    match_reasons: ['18 years safety experience', 'CHST certified', 'Director level', 'Industrial construction background'],
    source: 'linkedin' as const,
    profile_url: 'https://linkedin.com/in/sarah-martinez-safety',
  },
  {
    first_name: 'Robert',
    last_name: 'Williams',
    email: 'robert.williams@email.com',
    phone: '(713) 555-0256',
    linkedin_url: 'https://linkedin.com/in/robert-williams-construction-mgr',
    current_title: 'Project Engineer',
    current_company: 'Kiewit Corporation',
    location: 'Houston, TX',
    experience_years: 6,
    skills: ['AutoCAD', 'Revit', 'Primavera P6', 'RFI Management', 'Submittal Processing', 'Civil Engineering', 'Bridge Construction'],
    match_score: 78,
    match_reasons: ['Civil engineering background', 'Primavera P6 proficiency', 'Bridge construction experience', 'Growing career trajectory'],
    source: 'linkedin' as const,
    profile_url: 'https://linkedin.com/in/robert-williams-construction-mgr',
  },
  {
    first_name: 'Angela',
    last_name: 'Foster',
    email: 'angela.foster@email.com',
    phone: '(469) 555-0189',
    linkedin_url: 'https://linkedin.com/in/angela-foster-construction',
    current_title: 'Assistant Project Manager',
    current_company: 'DPR Construction',
    location: 'Dallas, TX',
    experience_years: 4,
    skills: ['Procore', 'PlanGrid', 'Document Control', 'Scheduling', 'Owner Relations', 'MEP Coordination', 'Data Center Construction'],
    match_score: 74,
    match_reasons: ['Procore & PlanGrid proficiency', 'Data center experience', 'Strong tech skills', 'Rapid career growth'],
    source: 'linkedin' as const,
    profile_url: 'https://linkedin.com/in/angela-foster-construction',
  },
  {
    first_name: 'Michael',
    last_name: 'Johnson',
    email: 'michael.johnson@email.com',
    phone: '(832) 555-0134',
    linkedin_url: 'https://linkedin.com/in/michael-johnson-foreman',
    current_title: 'General Foreman',
    current_company: 'Bechtel',
    location: 'Baytown, TX',
    experience_years: 20,
    skills: ['Crew Management', 'Concrete', 'Structural Steel', 'Equipment Operations', 'NCCER', 'Pipefitting', 'Petrochemical Construction'],
    match_score: 70,
    match_reasons: ['20 years field experience', 'NCCER certified', 'Petrochemical construction', 'Strong crew management skills'],
    source: 'linkedin' as const,
    profile_url: 'https://linkedin.com/in/michael-johnson-foreman',
  },
  {
    first_name: 'Lisa',
    last_name: 'Park',
    email: 'lisa.park@email.com',
    phone: '(281) 555-0178',
    linkedin_url: 'https://linkedin.com/in/lisa-park-bim',
    current_title: 'BIM Manager',
    current_company: 'Mortenson Construction',
    location: 'Houston, TX',
    experience_years: 8,
    skills: ['BIM 360', 'Revit', 'Navisworks', 'Clash Detection', 'VDC', 'Laser Scanning', 'Mixed-Use Construction'],
    match_score: 68,
    match_reasons: ['BIM/VDC expertise', 'Revit & Navisworks proficiency', 'Laser scanning experience', 'Mixed-use construction'],
    source: 'linkedin' as const,
    profile_url: 'https://linkedin.com/in/lisa-park-bim',
  },
  {
    first_name: 'James',
    last_name: 'Wilson',
    email: 'james.wilson@email.com',
    phone: '(972) 555-0145',
    linkedin_url: 'https://linkedin.com/in/james-wilson-controls',
    current_title: 'Project Controls Analyst',
    current_company: 'Fluor Corporation',
    location: 'Irving, TX',
    experience_years: 5,
    skills: ['Earned Value', 'Primavera P6', 'Cost Analysis', 'Risk Analysis', 'Forecasting', 'Data Visualization', 'LNG Construction'],
    match_score: 65,
    match_reasons: ['Project controls expertise', 'Primavera P6 certified', 'LNG construction background', 'Data-driven approach'],
    source: 'linkedin' as const,
    profile_url: 'https://linkedin.com/in/james-wilson-controls',
  },
  {
    first_name: 'Patricia',
    last_name: 'Brown',
    email: 'patricia.brown@email.com',
    phone: '(817) 555-0162',
    linkedin_url: 'https://linkedin.com/in/patricia-brown-contracts',
    current_title: 'Contract Administrator',
    current_company: 'AECOM',
    location: 'Fort Worth, TX',
    experience_years: 9,
    skills: ['Contract Administration', 'Claims Management', 'Change Orders', 'AIA Documents', 'Procurement', 'Negotiation', 'Government Contracts'],
    match_score: 62,
    match_reasons: ['Contract administration experience', 'AIA document expertise', 'Government contract knowledge', 'Claims management skills'],
    source: 'linkedin' as const,
    profile_url: 'https://linkedin.com/in/patricia-brown-contracts',
  },
]

async function _POST(request: NextRequest) {
  try {
    await requireAuth()

    const body = await request.json()
    const { jobId, searchQuery, location, maxResults = 20 } = body

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    if (!searchQuery || typeof searchQuery !== 'string' || !searchQuery.trim()) {
      return NextResponse.json({ error: 'searchQuery is required' }, { status: 400 })
    }

    // Verify job exists
    const [job] = await db
      .select({ id: jobs.id, title: jobs.title })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    let filteredCandidates = [...MOCK_CONSTRUCTION_CANDIDATES]

    if (location) {
      const locationLower = location.toLowerCase()
      filteredCandidates = filteredCandidates.filter(
        (c) =>
          c.location.toLowerCase().includes(locationLower) ||
          locationLower.includes(c.location.split(',')[0].toLowerCase())
      )
      if (filteredCandidates.length === 0) {
        filteredCandidates = [...MOCK_CONSTRUCTION_CANDIDATES]
      }
    }

    const limitedCandidates = filteredCandidates.slice(0, Math.min(maxResults, filteredCandidates.length))
    limitedCandidates.sort((a, b) => b.match_score - a.match_score)

    const taskId = `sourcing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    return NextResponse.json({
      taskId,
      status: 'complete',
      candidates: limitedCandidates,
      total_found: limitedCandidates.length,
      search_query: searchQuery,
      location: location || null,
    })
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const message = err instanceof Error ? err.message : 'Sourcing failed'
    logger.error({ message: 'LinkedIn sourcing error', error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
