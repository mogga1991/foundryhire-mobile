/**
 * Automated Lead Generation for Jobs
 *
 * This module provides automated lead generation functionality that triggers
 * when a job is created or manually requested. It integrates with the free-tier
 * orchestrator to generate and associate leads with specific job postings.
 */

import { db } from '@/lib/db'
import { jobs, candidates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateFreeLeads } from '@/lib/integrations/free-tier-orchestrator'

export interface LeadGenerationStats {
  jobId: string
  jobTitle: string
  totalLeadsGenerated: number
  savedToDatabase: number
  emailsFound: number
  phonesFound: number
  avgDataCompleteness: number
  avgMatchScore: number
  estimatedCost: number
  apiUsage: {
    apify: number
    apollo: number
    lusha: number
  }
  remainingApifyCredits: number
}

/**
 * Trigger lead generation for a specific job
 *
 * @param jobId - The ID of the job to generate leads for
 * @param companyId - The ID of the company (for verification and usage tracking)
 * @param maxLeads - Maximum number of leads to generate (default: 20, max: 50)
 * @returns Statistics about the generated leads
 */
export async function triggerLeadGenerationForJob(
  jobId: string,
  companyId: string,
  maxLeads: number = 20
): Promise<LeadGenerationStats> {
  console.log('[Auto Lead Gen] Starting for job:', jobId)

  // =============================================================================
  // Step 1: Fetch and validate job details
  // =============================================================================

  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)))
    .limit(1)

  if (!job) {
    throw new Error(`Job not found or does not belong to company: ${jobId}`)
  }

  if (!job.title) {
    throw new Error('Job title is required for lead generation')
  }

  // Extract search criteria
  const jobTitle = job.title
  const location = job.location || 'United States' // Default to US if no location specified

  console.log('[Auto Lead Gen] Job details:', {
    id: job.id,
    title: jobTitle,
    location,
  })

  // =============================================================================
  // Step 2: Generate leads using free-tier orchestrator
  // =============================================================================

  const safeMaxLeads = Math.min(Math.max(maxLeads, 1), 50) // Clamp to 1-50

  console.log('[Auto Lead Gen] Calling free-tier orchestrator:', {
    jobTitle,
    location,
    maxLeads: safeMaxLeads,
  })

  const { leads, stats } = await generateFreeLeads(
    jobTitle,
    location,
    safeMaxLeads,
    companyId // Pass company ID for usage tracking
  )

  console.log('[Auto Lead Gen] Generated leads:', {
    totalLeads: leads.length,
    emailsFound: stats.emailsFound,
    phonesFound: stats.phonesFound,
  })

  // =============================================================================
  // Step 3: Save leads to database with job association
  // =============================================================================

  const savedCandidates = []
  // Filter out leads without emails since email is required in database
  const leadsWithEmails = leads.filter(lead => lead.email !== null)

  for (const lead of leadsWithEmails) {
    try {
      const [savedCandidate] = await db
        .insert(candidates)
        .values({
          companyId,
          jobId, // Associate with this job
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email!,
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
          createdAt: new Date(),
        })
        .returning()

      savedCandidates.push(savedCandidate)
    } catch (error) {
      console.error('[Auto Lead Gen] Error saving candidate:', lead.fullName, error)
      // Continue with other leads even if one fails
    }
  }

  console.log('[Auto Lead Gen] Saved to database:', savedCandidates.length)

  // =============================================================================
  // Step 4: Return statistics
  // =============================================================================

  const result: LeadGenerationStats = {
    jobId: job.id,
    jobTitle: job.title,
    totalLeadsGenerated: leads.length,
    savedToDatabase: savedCandidates.length,
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
  }

  console.log('[Auto Lead Gen] Complete:', result)

  return result
}

/**
 * Validate if lead generation can be run for a job
 *
 * @param jobId - The ID of the job
 * @param companyId - The ID of the company
 * @returns Object with validation result and any error messages
 */
export async function canGenerateLeadsForJob(
  jobId: string,
  companyId: string
): Promise<{
  canGenerate: boolean
  reason?: string
}> {
  // Check if job exists and belongs to company
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)))
    .limit(1)

  if (!job) {
    return {
      canGenerate: false,
      reason: 'Job not found or does not belong to company',
    }
  }

  if (!job.title) {
    return {
      canGenerate: false,
      reason: 'Job must have a title for lead generation',
    }
  }

  return { canGenerate: true }
}
