/**
 * API Route: Generate Leads
 *
 * This endpoint triggers the lead generation pipeline:
 * 1. LinkedIn: Primary source via Apify
 * 2. Indeed: Secondary source via Apify (optional)
 * 3. Apollo: Email enrichment
 * 4. Lusha: Phone enrichment
 * 5. Coresignal: Profile enrichment (experience, skills)
 * 6. AI: Candidate scoring
 *
 * All results are saved with deduplication support.
 *
 * Request body:
 * - jobTitle (required)
 * - location (required)
 * - maxLeads (optional, 1-50, default 20)
 * - jobId (optional, associate leads with a specific job)
 * - sources (optional, array of 'linkedin' | 'indeed', default: ['linkedin'])
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { companyUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateFreeLeads } from '@/lib/integrations/free-tier-orchestrator'
import { deduplicateBatch, type CandidateInput } from '@/lib/services/deduplication'
import { queueEnrichmentBatch } from '@/lib/services/enrichment-queue'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's company
    const [companyUser] = await db
      .select({ companyId: companyUsers.companyId })
      .from(companyUsers)
      .where(eq(companyUsers.userId, session.user.id))
      .limit(1)

    if (!companyUser) {
      return NextResponse.json(
        { error: 'No company found. Please set up your company first.' },
        { status: 400 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { jobTitle, location, maxLeads, jobId, sources } = body

    // Validate inputs
    if (!jobTitle || !location) {
      return NextResponse.json(
        { error: 'jobTitle and location are required' },
        { status: 400 }
      )
    }

    const safeMaxLeads = Math.min(Math.max(maxLeads || 20, 1), 50) // Clamp to 1-50
    const validSources = (sources as string[] | undefined)?.filter(
      (s: string) => ['linkedin', 'indeed'].includes(s)
    ) as Array<'linkedin' | 'indeed'> | undefined

    console.log('[Lead Generation] Starting:', {
      jobTitle,
      location,
      maxLeads: safeMaxLeads,
      sources: validSources || ['linkedin'],
      companyId: companyUser.companyId,
    })

    // Generate leads using free tier APIs
    const { leads, stats } = await generateFreeLeads(
      jobTitle,
      location,
      safeMaxLeads,
      companyUser.companyId,
      validSources
    )

    console.log('[Lead Generation] Generated leads:', {
      totalLeads: leads.length,
      emailsFound: stats.emailsFound,
      phonesFound: stats.phonesFound,
      avgScore: stats.avgMatchScore,
    })

    // Save all leads with deduplication (including those without emails)
    const candidateInputs: CandidateInput[] = leads.map(lead => ({
      companyId: companyUser.companyId,
      jobId: jobId || null,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email || null,
      phone: lead.phone,
      currentTitle: lead.currentTitle,
      currentCompany: lead.currentCompany,
      location: lead.location,
      linkedinUrl: lead.linkedinUrl,
      experienceYears: lead.experienceYears,
      skills: lead.skills,
      aiScore: lead.matchScore,
      stage: 'sourced',
      source: lead.source,
      enrichmentSource: lead.enrichedWith.join(', '),
      dataCompleteness: lead.dataCompleteness,
      socialProfiles: {
        linkedin: lead.linkedinUrl,
      },
      // Rich data from Leads Finder
      companyInfo: lead._companyInfo || null,
      headline: lead._headline || null,
    }))

    const { results: dedupResults, stats: dedupStats } = await deduplicateBatch(
      companyUser.companyId,
      candidateInputs,
      'merge_best'
    )

    console.log('[Lead Generation] Dedup results:', dedupStats)

    // Queue enrichment for newly inserted candidates
    const newCandidateIds = dedupResults
      .filter(r => r.action === 'insert' && r.candidateId)
      .map(r => r.candidateId!)

    if (newCandidateIds.length > 0) {
      try {
        await queueEnrichmentBatch(newCandidateIds, companyUser.companyId)
        console.log(`[Lead Generation] Queued enrichment for ${newCandidateIds.length} candidates`)
      } catch (err) {
        console.error('[Lead Generation] Failed to queue enrichment:', err)
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalLeads: leads.length,
        savedToDatabase: dedupStats.inserted,
        updated: dedupStats.updated,
        duplicatesSkipped: dedupStats.skipped,
        emailsFound: stats.emailsFound,
        phonesFound: stats.phonesFound,
        avgDataCompleteness: stats.avgDataCompleteness,
        avgMatchScore: stats.avgMatchScore,
        estimatedCost: stats.estimatedCost,
        apiUsage: {
          apify: stats.apifyUsed,
          apollo: stats.apolloUsed,
          lusha: stats.lushaUsed,
        },
        remainingApifyCredits: stats.remainingApifyCredits,
        sources: validSources || ['linkedin'],
      },
      leads: leads.map((lead) => ({
        fullName: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        currentTitle: lead.currentTitle,
        currentCompany: lead.currentCompany,
        matchScore: lead.matchScore,
        dataCompleteness: lead.dataCompleteness,
        source: lead.source,
      })),
    })
  } catch (error) {
    console.error('[Lead Generation] API Error:', error)
    return NextResponse.json(
      {
        error: 'Lead generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
