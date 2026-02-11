/**
 * FREE TIER Lead Orchestrator
 *
 * Optimized to use only free trials and stay within limits:
 * - Apify: 20-50 leads (testing mode)
 * - Apollo.io: Free tier available
 * - Coresignal: Trial credits
 * - Proxycurl: 2 req/minute trial (limited use)
 * - Lusha: Free tier available
 *
 * This version intelligently uses free tiers and caches results.
 */

import * as Apollo from './apollo'
import * as Coresignal from './coresignal'
import * as Lusha from './lusha'
// @ts-ignore - apify-client has broken type definitions referencing non-existent src/ paths
import { ApifyClient } from 'apify-client'
import { scoreCandidate } from '@/lib/ai/mistral'
import { db } from '@/lib/db'
import { apiUsage } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'

const logger = createLogger('integration:free-tier-orchestrator')

const apifyClient = new ApifyClient({
  token: env.APIFY_API_TOKEN || '',
})

// =============================================================================
// FREE TIER LIMITS
// =============================================================================

const FREE_TIER_LIMITS = {
  apify: {
    maxLeads: 50, // User requested limit for testing
    costPerLead: 0.20, // $10/month for 50 leads
  },
  apollo: {
    maxPerMonth: 50, // Free tier estimate
    requestsPerSecond: 1,
  },
  coresignal: {
    maxPerMonth: 100, // Trial credits
    requestsPerSecond: 1,
  },
  proxycurl: {
    maxPerMinute: 2, // Trial: 2 req/minute
    maxPerMonth: 100, // Trial limit
  },
  lusha: {
    maxPerMonth: 50, // Free tier
    requestsPerSecond: 5, // Conservative for free tier
  },
  mistral: {
    costPerScore: 0.01, // Very cheap with Mistral
  },
}

// =============================================================================
// Types
// =============================================================================

export type LeadSource = 'apify' | 'apollo' | 'lusha' | 'coresignal' | 'indeed' | 'github' | 'csv_import'

export interface FreeTierLead {
  // Basic Info
  firstName: string
  lastName: string
  fullName: string

  // Contact (prioritize free sources)
  email: string | null
  emailSource: 'apify' | 'apollo' | 'lusha' | null
  phone: string | null
  phoneSource: 'apify' | 'lusha' | null

  // Position
  currentTitle: string | null
  currentCompany: string | null
  location: string | null

  // LinkedIn
  linkedinUrl: string | null

  // Experience & Skills
  experienceYears: number | null
  skills: string[]

  // Quality
  dataCompleteness: number
  matchScore: number
  matchReasons: string[]

  // Metadata
  source: LeadSource
  enrichedWith: string[]
  createdAt: string

  // Extended data (carried through pipeline for DB mapping)
  _companyInfo?: Record<string, unknown>
  _headline?: string
  _personalEmail?: string
  _seniority?: string
}

export interface FreeTierStats {
  totalLeads: number
  apifyUsed: number
  apolloUsed: number
  lushaUsed: number
  coresignalUsed: number
  proxycurlUsed: number
  indeedUsed: number
  githubUsed: number
  emailsFound: number
  phonesFound: number
  avgDataCompleteness: number
  avgMatchScore: number
  estimatedCost: number
  remainingApifyCredits: number
}

// =============================================================================
// Main Free Tier Pipeline
// =============================================================================

/**
 * Generate leads using only free tiers
 * Limits: 20-50 leads total (Apify constraint)
 */
export async function generateFreeLeads(
  jobTitle: string,
  location: string,
  maxLeads: number = 20, // Default to 20 for testing
  companyId?: string, // Optional for usage tracking
  sources?: Array<'linkedin' | 'indeed'> // Optional: which sources to use
): Promise<{
  leads: FreeTierLead[]
  stats: FreeTierStats
}> {
  logger.info({ message: 'Starting lead generation' })
  logger.info({ message: 'Target leads', maxLeads })

  // Enforce Apify limit
  const safeMaxLeads = Math.min(maxLeads, FREE_TIER_LIMITS.apify.maxLeads)

  // Determine which sources to use (default: linkedin only)
  const activeSources = sources || ['linkedin']

  const stats: FreeTierStats = {
    totalLeads: 0,
    apifyUsed: 0,
    apolloUsed: 0,
    lushaUsed: 0,
    coresignalUsed: 0,
    proxycurlUsed: 0,
    indeedUsed: 0,
    githubUsed: 0,
    emailsFound: 0,
    phonesFound: 0,
    avgDataCompleteness: 0,
    avgMatchScore: 0,
    estimatedCost: 0,
    remainingApifyCredits: FREE_TIER_LIMITS.apify.maxLeads,
  }

  const leads: FreeTierLead[] = []

  // Calculate per-source budget
  const sourceCount = activeSources.length
  const perSourceBudget = Math.ceil(safeMaxLeads / sourceCount)

  // =============================================================================
  // STAGE 1A: LINKEDIN SOURCE - Apify (Most Reliable for Free)
  // =============================================================================

  if (activeSources.includes('linkedin')) {
  logger.info({ message: 'Stage 1A: Leads Finder (code_crafter/leads-finder)' })

  try {
    // Use Leads Finder actor for richer data: emails, phones, LinkedIn URLs, company firmographics
    const apifyRun = await apifyClient.actor('IoSHqwTR9YGhzccez').call({
      contact_job_title: [jobTitle],
      contact_location: [location.toLowerCase()],
      fetch_count: perSourceBudget,
      email_status: ['validated'],
    })

    const { items } = await apifyClient.dataset(apifyRun.defaultDatasetId).listItems()

    for (const item of items) {
      // Build location from city/state/country
      const locParts = [item.city, item.state, item.country].filter(
        (p) => p && typeof p === 'string' && p.trim() !== ''
      )
      const itemLocation = locParts.length > 0 ? locParts.join(', ') : null

      // Build company info from firmographic fields
      const companyInfo: Record<string, unknown> = {}
      if (item.company_name) companyInfo.name = String(item.company_name)
      if (item.company_domain) companyInfo.domain = String(item.company_domain)
      if (item.company_size) companyInfo.size = String(item.company_size)
      if (item.industry) companyInfo.industry = String(item.industry)
      if (item.company_founded_year) companyInfo.foundedYear = String(item.company_founded_year)
      if (item.company_description) companyInfo.description = String(item.company_description)
      if (item.company_annual_revenue) companyInfo.annualRevenue = String(item.company_annual_revenue)

      const lead: FreeTierLead = {
        firstName: String(item.first_name || ''),
        lastName: String(item.last_name || ''),
        fullName: `${item.first_name || ''} ${item.last_name || ''}`.trim(),
        email: (item.email && typeof item.email === 'string') ? item.email : null,
        emailSource: item.email ? 'apify' : null,
        phone: (item.mobile_number && typeof item.mobile_number === 'string') ? item.mobile_number : null,
        phoneSource: item.mobile_number ? 'apify' : null,
        currentTitle: (item.job_title && typeof item.job_title === 'string') ? String(item.job_title) : ((item.headline && typeof item.headline === 'string') ? String(item.headline) : null),
        currentCompany: (item.company_name && typeof item.company_name === 'string') ? String(item.company_name) : null,
        location: (typeof itemLocation === 'string') ? itemLocation : null,
        linkedinUrl: (item.linkedin && typeof item.linkedin === 'string') ? String(item.linkedin) : null,
        experienceYears: null,
        skills: [],
        dataCompleteness: 0,
        matchScore: 0,
        matchReasons: [],
        source: 'apify',
        enrichedWith: ['leads-finder'],
        createdAt: new Date().toISOString(),
        // Extended fields stored on the lead for later DB mapping
        ...(Object.keys(companyInfo).length > 0 ? { _companyInfo: companyInfo } : {}),
        ...(item.headline ? { _headline: String(item.headline) } : {}),
        ...(item.personal_email ? { _personalEmail: String(item.personal_email) } : {}),
        ...(item.seniority ? { _seniority: String(item.seniority) } : {}),
      } as FreeTierLead

      if (lead.email) stats.emailsFound++
      if (lead.phone) stats.phonesFound++

      leads.push(lead)
      stats.apifyUsed++
    }

    logger.info({ message: 'Leads Finder found leads', count: leads.length })
  } catch (error) {
    logger.error({ message: 'Leads Finder error', error })
  }
  } // end LinkedIn source

  // =============================================================================
  // STAGE 1B: INDEED SOURCE - Apify Indeed Scraper
  // =============================================================================

  if (activeSources.includes('indeed')) {
    logger.info({ message: 'Stage 1B: Indeed scraping' })

    try {
      const indeedRun = await apifyClient.actor('misceres/indeed-scraper').call({
        position: jobTitle,
        location: location,
        maxItems: perSourceBudget,
        parseCompanyDetails: false,
      })

      const { items: indeedItems } = await apifyClient
        .dataset(indeedRun.defaultDatasetId)
        .listItems()

      for (const item of indeedItems) {
        const lead: FreeTierLead = {
          firstName: String(item.firstName || item.first_name || ''),
          lastName: String(item.lastName || item.last_name || ''),
          fullName: `${item.firstName || item.first_name || ''} ${item.lastName || item.last_name || ''}`.trim()
            || String(item.positionName || item.company || 'Unknown'),
          email: (item.email && typeof item.email === 'string') ? item.email : null,
          emailSource: item.email ? 'apify' : null,
          phone: (item.phoneNumber && typeof item.phoneNumber === 'string') ? item.phoneNumber : null,
          phoneSource: item.phoneNumber ? 'apify' : null,
          currentTitle: String(item.positionName || item.title || ''),
          currentCompany: String(item.company || ''),
          location: String(item.location || ''),
          linkedinUrl: null,
          experienceYears: null,
          skills: [],
          dataCompleteness: 0,
          matchScore: 0,
          matchReasons: [],
          source: 'indeed',
          enrichedWith: ['indeed'],
          createdAt: new Date().toISOString(),
        }

        // Parse name from positionName or description if missing
        if (!lead.firstName && lead.fullName && lead.fullName !== 'Unknown') {
          const parts = lead.fullName.split(/\s+/)
          lead.firstName = parts[0] || ''
          lead.lastName = parts.slice(1).join(' ') || ''
        }

        if (lead.email) stats.emailsFound++
        if (lead.phone) stats.phonesFound++

        leads.push(lead)
        stats.indeedUsed++
      }

      logger.info({ message: 'Indeed found leads', count: stats.indeedUsed })
    } catch (error) {
      logger.error({ message: 'Indeed scraping error', error })
    }
  }

  // =============================================================================
  // STAGE 2: ENRICHMENT - Fill Missing Data (Free Tiers Only)
  // =============================================================================

  logger.info({ message: 'Stage 2: Enrichment' })

  // Track API usage to stay within free limits
  let apolloUsed = 0
  let lushaUsed = 0
  let coresignalUsed = 0

  for (const lead of leads) {
    // Only enrich if missing critical data
    const needsEnrichment = !lead.email || !lead.phone

    if (!needsEnrichment) {
      logger.info({ message: 'Lead already complete, skipping enrichment', leadName: lead.fullName })
      continue
    }

    // -----------------------------------------------------------------
    // Try Apollo for email (FREE TIER)
    // -----------------------------------------------------------------
    if (!lead.email && apolloUsed < FREE_TIER_LIMITS.apollo.maxPerMonth) {
      if (lead.firstName && lead.lastName && lead.currentCompany) {
        try {
          const domain = extractDomain(lead.currentCompany)
          if (domain) {
            const apolloEmail = await Apollo.findEmail(
              lead.firstName,
              lead.lastName,
              domain
            )

            if (apolloEmail) {
              lead.email = apolloEmail
              lead.emailSource = 'apollo'
              lead.enrichedWith.push('apollo')
              stats.emailsFound++
              apolloUsed++
              stats.apolloUsed++

              // Rate limit: 1 req/sec
              await sleep(1000)
            }
          }
        } catch (error) {
          logger.warn({ message: 'Apollo enrichment failed', leadName: lead.fullName })
        }
      }
    }

    // -----------------------------------------------------------------
    // Try Lusha for phone (FREE TIER)
    // -----------------------------------------------------------------
    if (!lead.phone && lushaUsed < FREE_TIER_LIMITS.lusha.maxPerMonth) {
      if (lead.firstName && lead.lastName && lead.currentCompany) {
        try {
          const phone = await Lusha.findPhone(
            lead.firstName,
            lead.lastName,
            lead.currentCompany
          )

          if (phone) {
            lead.phone = phone
            lead.phoneSource = 'lusha'
            lead.enrichedWith.push('lusha')
            stats.phonesFound++
            lushaUsed++
            stats.lushaUsed++

            // Rate limit: 5 req/sec for free tier
            await sleep(200)
          }
        } catch (error) {
          logger.warn({ message: 'Lusha enrichment failed', leadName: lead.fullName })
        }
      }
    }

    // -----------------------------------------------------------------
    // Try Coresignal for profile enrichment (experience, skills, verification)
    // -----------------------------------------------------------------
    if (coresignalUsed < FREE_TIER_LIMITS.coresignal.maxPerMonth) {
      if (lead.firstName && lead.lastName) {
        try {
          const csResults = await Coresignal.searchEmployeesClean({
            title: `${lead.firstName} ${lead.lastName}`,
            company: lead.currentCompany || undefined,
            location: lead.location || undefined,
            limit: 1,
          })

          const csProfile = csResults[0]
          if (csProfile) {
            // Enrich with experience years
            if (!lead.experienceYears && csProfile.total_experience_months) {
              lead.experienceYears = Math.round(csProfile.total_experience_months / 12)
            }

            // Enrich with skills
            if (lead.skills.length === 0 && csProfile.skills.length > 0) {
              lead.skills = csProfile.skills.slice(0, 15)
            }

            // Enrich with LinkedIn URL
            if (!lead.linkedinUrl && csProfile.linkedin_url) {
              lead.linkedinUrl = csProfile.linkedin_url
            }

            // Enrich with verified title and company from current position
            const currentPos = Coresignal.getCurrentPosition(csProfile)
            if (currentPos) {
              if (!lead.currentTitle) lead.currentTitle = currentPos.title
              if (!lead.currentCompany) lead.currentCompany = currentPos.company
            }

            lead.enrichedWith.push('coresignal')
            coresignalUsed++
            stats.coresignalUsed++

            // Rate limit: 1 req/sec
            await sleep(1000)
          }
        } catch (error) {
          logger.warn({ message: 'Coresignal enrichment failed', leadName: lead.fullName })
        }
      }
    }

    // -----------------------------------------------------------------
    // Calculate data completeness
    // -----------------------------------------------------------------
    const fields = [
      lead.email,
      lead.phone,
      lead.currentTitle,
      lead.currentCompany,
      lead.location,
      lead.linkedinUrl,
      lead.skills.length > 0,
    ]
    lead.dataCompleteness = Math.round(
      (fields.filter(Boolean).length / fields.length) * 100
    )
  }

  // =============================================================================
  // STAGE 3: AI SCORING (Very Cheap - $0.01 per lead)
  // =============================================================================

  logger.info({ message: 'Stage 3: AI Scoring' })

  for (const lead of leads) {
    try {
      const candidateInfo = `Candidate: ${lead.fullName}
Title: ${lead.currentTitle || 'Unknown'}
Company: ${lead.currentCompany || 'Unknown'}
Location: ${lead.location || 'Unknown'}
Experience: ${lead.experienceYears || 'Unknown'} years
Skills: ${lead.skills.join(', ') || 'None listed'}`

      const jobCriteria = `Job Title: ${jobTitle}
Location: ${location}
Industry: Construction`

      const result = await scoreCandidate(candidateInfo, jobCriteria)
      lead.matchScore = result.score || 50
      lead.matchReasons = result.reasons || []
    } catch (error) {
      logger.warn({ message: 'AI scoring failed', leadName: lead.fullName })
      lead.matchScore = 50
      lead.matchReasons = ['Auto-scored']
    }
  }

  // Sort by match score
  leads.sort((a, b) => b.matchScore - a.matchScore)

  // =============================================================================
  // Final Stats
  // =============================================================================

  stats.totalLeads = leads.length
  stats.avgDataCompleteness = Math.round(
    leads.reduce((sum, l) => sum + l.dataCompleteness, 0) / leads.length
  )
  stats.avgMatchScore = Math.round(
    leads.reduce((sum, l) => sum + l.matchScore, 0) / leads.length
  )
  stats.estimatedCost =
    stats.apifyUsed * FREE_TIER_LIMITS.apify.costPerLead +
    stats.totalLeads * FREE_TIER_LIMITS.mistral.costPerScore
  stats.remainingApifyCredits = FREE_TIER_LIMITS.apify.maxLeads - stats.apifyUsed

  logger.info({
    message: 'Lead generation complete',
    totalLeads: stats.totalLeads,
    avgDataCompleteness: stats.avgDataCompleteness,
    avgMatchScore: stats.avgMatchScore,
    estimatedCost: stats.estimatedCost.toFixed(2),
    remainingApifyCredits: stats.remainingApifyCredits
  })

  // Update usage tracking in database
  if (companyId) {
    try {
      await updateApiUsage(companyId, {
        apifyLeads: stats.apifyUsed,
        apolloCalls: stats.apolloUsed,
        lushaCalls: stats.lushaUsed,
        coresignalCalls: stats.coresignalUsed,
        proxycurlCalls: stats.proxycurlUsed,
        costInCents: Math.round(stats.estimatedCost * 100), // Convert to cents
      })
      logger.info({ message: 'Usage tracking updated in database' })
    } catch (error) {
      logger.error({ message: 'Failed to update usage tracking', error })
    }
  }

  return { leads, stats }
}

// =============================================================================
// Helper Functions
// =============================================================================

function extractDomain(companyName: string): string | null {
  const cleaned = companyName.toLowerCase().replace(/[^a-z0-9]/g, '')

  const knownDomains: Record<string, string> = {
    turnerconstruction: 'turnerconstruction.com',
    skanska: 'skanska.com',
    bechtel: 'bechtel.com',
    fluor: 'fluor.com',
    kiewit: 'kiewit.com',
    mccarthy: 'mccarthy.com',
    hensel: 'henselphelps.com',
    henselphelps: 'henselphelps.com',
    mortenson: 'mortenson.com',
    jacobs: 'jacobs.com',
    aecom: 'aecom.com',
    pcl: 'pcl.com',
    dpr: 'dpr.com',
    suffolk: 'suffolkconstruction.com',
    balfour: 'balfourbeattyus.com',
    whiting: 'whiting-turner.com',
  }

  return knownDomains[cleaned] || `${cleaned}.com`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// =============================================================================
// Usage Tracking (Store in DB)
// =============================================================================

export interface ApiUsageRecord {
  date: string
  apifyLeads: number
  apolloCalls: number
  lushaCalls: number
  coresignalCalls: number
  proxycurlCalls: number
  totalCost: number
}

/**
 * Track API usage to avoid exceeding free tiers
 */
export async function getMonthlyUsage(companyId: string): Promise<ApiUsageRecord> {
  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

  const [usage] = await db
    .select()
    .from(apiUsage)
    .where(and(eq(apiUsage.companyId, companyId), eq(apiUsage.month, currentMonth)))
    .limit(1)

  if (!usage) {
    return {
      date: currentMonth,
      apifyLeads: 0,
      apolloCalls: 0,
      lushaCalls: 0,
      coresignalCalls: 0,
      proxycurlCalls: 0,
      totalCost: 0,
    }
  }

  return {
    date: usage.month,
    apifyLeads: usage.apifyLeads,
    apolloCalls: usage.apolloCalls,
    lushaCalls: usage.lushaCalls,
    coresignalCalls: usage.coresignalCalls,
    proxycurlCalls: usage.proxycurlCalls,
    totalCost: usage.totalCost,
  }
}

/**
 * Check if we can make more API calls this month
 */
export async function canMakeApiCall(
  companyId: string,
  api: 'apify' | 'apollo' | 'lusha' | 'coresignal' | 'proxycurl'
): Promise<boolean> {
  const usage = await getMonthlyUsage(companyId)

  const limits = {
    apify: FREE_TIER_LIMITS.apify.maxLeads,
    apollo: FREE_TIER_LIMITS.apollo.maxPerMonth,
    lusha: FREE_TIER_LIMITS.lusha.maxPerMonth,
    coresignal: FREE_TIER_LIMITS.coresignal.maxPerMonth,
    proxycurl: FREE_TIER_LIMITS.proxycurl.maxPerMonth,
  }

  const currentUsage = {
    apify: usage.apifyLeads,
    apollo: usage.apolloCalls,
    lusha: usage.lushaCalls,
    coresignal: usage.coresignalCalls,
    proxycurl: usage.proxycurlCalls,
  }

  return currentUsage[api] < limits[api]
}

/**
 * Update API usage in database
 */
export async function updateApiUsage(
  companyId: string,
  updates: {
    apifyLeads?: number
    apolloCalls?: number
    lushaCalls?: number
    coresignalCalls?: number
    proxycurlCalls?: number
    costInCents?: number
  }
): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

  // Try to get existing record
  const [existing] = await db
    .select()
    .from(apiUsage)
    .where(and(eq(apiUsage.companyId, companyId), eq(apiUsage.month, currentMonth)))
    .limit(1)

  if (existing) {
    // Update existing record
    await db
      .update(apiUsage)
      .set({
        apifyLeads: (existing.apifyLeads || 0) + (updates.apifyLeads || 0),
        apolloCalls: (existing.apolloCalls || 0) + (updates.apolloCalls || 0),
        lushaCalls: (existing.lushaCalls || 0) + (updates.lushaCalls || 0),
        coresignalCalls: (existing.coresignalCalls || 0) + (updates.coresignalCalls || 0),
        proxycurlCalls: (existing.proxycurlCalls || 0) + (updates.proxycurlCalls || 0),
        totalCost: (existing.totalCost || 0) + (updates.costInCents || 0),
        updatedAt: new Date(),
      })
      .where(eq(apiUsage.id, existing.id))
  } else {
    // Create new record
    await db.insert(apiUsage).values({
      companyId,
      month: currentMonth,
      apifyLeads: updates.apifyLeads || 0,
      apolloCalls: updates.apolloCalls || 0,
      lushaCalls: updates.lushaCalls || 0,
      coresignalCalls: updates.coresignalCalls || 0,
      proxycurlCalls: updates.proxycurlCalls || 0,
      totalCost: updates.costInCents || 0,
    })
  }
}
