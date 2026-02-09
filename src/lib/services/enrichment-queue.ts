/**
 * Progressive Enrichment Queue Service
 *
 * Manages a queue of enrichment tasks that progressively fill in
 * missing candidate data over time. Tasks are prioritized and rate-limited
 * to stay within free-tier API limits.
 *
 * Enrichment types (in priority order):
 * 1. email_find - Find email using Apollo/Hunter
 * 2. email_verify - Verify email deliverability
 * 3. phone_find - Find phone using Lusha
 * 4. phone_verify - Verify phone type
 * 5. linkedin_profile - Enrich from LinkedIn via Proxycurl
 * 6. company_info - Enrich company data via Coresignal
 * 7. ai_score - Score candidate with AI
 */

import { db } from '@/lib/db'
import { enrichmentQueue, candidates } from '@/lib/db/schema'
import { eq, and, lte, sql, asc, count, inArray } from 'drizzle-orm'
import * as Apollo from '@/lib/integrations/apollo'
import * as Lusha from '@/lib/integrations/lusha'
import { scoreCandidate } from '@/lib/ai/mistral'
import { scrapeLinkedInProfile } from '@/lib/integrations/linkedin-profile-scraper'

// =============================================================================
// Types
// =============================================================================

type EnrichmentType =
  | 'email_find'
  | 'email_verify'
  | 'phone_find'
  | 'phone_verify'
  | 'linkedin_profile'
  | 'company_info'
  | 'ai_score'

const ENRICHMENT_PRIORITIES: Record<EnrichmentType, number> = {
  email_find: 1,
  email_verify: 2,
  phone_find: 3,
  phone_verify: 4,
  linkedin_profile: 5,
  company_info: 6,
  ai_score: 7,
}

export interface EnrichmentStatus {
  pending: number
  inProgress: number
  completed: number
  failed: number
  totalCandidates: number
  avgCompleteness: number
}

// =============================================================================
// Queue Management
// =============================================================================

/**
 * Analyze a candidate and queue the enrichment tasks it needs.
 */
export async function queueEnrichmentForCandidate(
  candidateId: string,
  companyId: string
): Promise<number> {
  // Fetch the candidate
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1)

  if (!candidate) return 0

  const tasks: Array<{ type: EnrichmentType; priority: number }> = []

  // Check what's missing
  if (!candidate.email || candidate.email === '') {
    tasks.push({ type: 'email_find', priority: ENRICHMENT_PRIORITIES.email_find })
  } else if (!candidate.emailVerified) {
    tasks.push({ type: 'email_verify', priority: ENRICHMENT_PRIORITIES.email_verify })
  }

  if (!candidate.phone) {
    tasks.push({ type: 'phone_find', priority: ENRICHMENT_PRIORITIES.phone_find })
  } else if (!candidate.phoneVerified) {
    tasks.push({ type: 'phone_verify', priority: ENRICHMENT_PRIORITIES.phone_verify })
  }

  if (candidate.linkedinUrl && !candidate.linkedinScrapedAt) {
    tasks.push({
      type: 'linkedin_profile',
      priority: ENRICHMENT_PRIORITIES.linkedin_profile,
    })
  }

  if (!candidate.companyInfo && candidate.currentCompany) {
    tasks.push({ type: 'company_info', priority: ENRICHMENT_PRIORITIES.company_info })
  }

  if (!candidate.aiScore || candidate.aiScore === 0) {
    tasks.push({ type: 'ai_score', priority: ENRICHMENT_PRIORITIES.ai_score })
  }

  if (tasks.length === 0) {
    // Candidate is fully enriched
    await db
      .update(candidates)
      .set({ enrichmentStatus: 'complete', updatedAt: new Date() })
      .where(eq(candidates.id, candidateId))
    return 0
  }

  // Insert tasks into the queue
  const now = new Date()
  await db.insert(enrichmentQueue).values(
    tasks.map((task) => ({
      candidateId,
      companyId,
      enrichmentType: task.type,
      status: 'pending',
      priority: task.priority,
      attempts: 0,
      maxAttempts: 3,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    }))
  )

  // Mark candidate as pending enrichment
  await db
    .update(candidates)
    .set({ enrichmentStatus: 'pending', updatedAt: new Date() })
    .where(eq(candidates.id, candidateId))

  return tasks.length
}

/**
 * Queue enrichment for multiple candidates.
 */
export async function queueEnrichmentBatch(
  candidateIds: string[],
  companyId: string
): Promise<number> {
  let totalQueued = 0
  for (const id of candidateIds) {
    totalQueued += await queueEnrichmentForCandidate(id, companyId)
  }
  return totalQueued
}

// =============================================================================
// Task Processing
// =============================================================================

/**
 * Process the next batch of enrichment tasks for a company.
 */
export async function processEnrichmentBatch(
  companyId: string,
  batchSize: number = 10
): Promise<{
  processed: number
  succeeded: number
  failed: number
  remaining: number
}> {
  const now = new Date()

  // First, auto-fail unimplemented enrichment types so they don't clog the queue
  const unimplementedTypes = ['email_verify', 'phone_verify', 'company_info']
  await db
    .update(enrichmentQueue)
    .set({
      status: 'failed',
      lastError: 'Not yet implemented — skipped',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(enrichmentQueue.companyId, companyId),
        eq(enrichmentQueue.status, 'pending'),
        inArray(enrichmentQueue.enrichmentType, unimplementedTypes)
      )
    )

  // Fetch next batch of pending tasks (ordered by priority, then by next attempt time)
  const tasks = await db
    .select()
    .from(enrichmentQueue)
    .where(
      and(
        eq(enrichmentQueue.companyId, companyId),
        eq(enrichmentQueue.status, 'pending'),
        lte(enrichmentQueue.nextAttemptAt, now)
      )
    )
    .orderBy(
      asc(enrichmentQueue.priority),
      asc(enrichmentQueue.nextAttemptAt)
    )
    .limit(batchSize)

  let succeeded = 0
  let failed = 0

  // Track enrichment types that hit rate limits so we skip the rest of that type
  const rateLimitedTypes = new Set<string>()

  for (const task of tasks) {
    // Skip tasks whose enrichment type already hit a rate limit in this batch
    if (rateLimitedTypes.has(task.enrichmentType)) {
      continue
    }

    // Mark as in_progress
    await db
      .update(enrichmentQueue)
      .set({ status: 'in_progress', lastAttemptAt: now, updatedAt: now })
      .where(eq(enrichmentQueue.id, task.id))

    try {
      const result = await executeEnrichmentTask(task)

      if (result.success) {
        // Mark completed and apply result to candidate
        await db
          .update(enrichmentQueue)
          .set({
            status: 'completed',
            result: result.data || null,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(enrichmentQueue.id, task.id))

        if (result.data) {
          await applyEnrichmentResult(task.candidateId, task.enrichmentType as EnrichmentType, result.data)
        }

        succeeded++
      } else {
        throw new Error(result.error || 'Unknown enrichment error')
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'unknown'
      const isRateLimit = errorMsg.includes('429') || errorMsg.toLowerCase().includes('rate limit')
      const isPermanent = errorMsg.startsWith('PERMANENT:')
      const attempts = (task.attempts || 0) + 1
      const maxAttempts = task.maxAttempts || 3

      if (isRateLimit) {
        // Rate limited — mark this type so we skip remaining tasks of same type
        rateLimitedTypes.add(task.enrichmentType)
        // Put task back to pending with a longer cooldown (30 min)
        await db
          .update(enrichmentQueue)
          .set({
            status: 'pending',
            attempts,
            lastError: `Rate limited (429) — will retry later`,
            nextAttemptAt: new Date(Date.now() + 30 * 60 * 1000),
            updatedAt: new Date(),
          })
          .where(eq(enrichmentQueue.id, task.id))
      } else if (isPermanent || attempts >= maxAttempts) {
        // Permanent error or max retries reached - mark as failed
        await db
          .update(enrichmentQueue)
          .set({
            status: 'failed',
            attempts,
            lastError: errorMsg,
            updatedAt: new Date(),
          })
          .where(eq(enrichmentQueue.id, task.id))
      } else {
        // Transient error — schedule retry with exponential backoff
        const backoffMs = Math.pow(2, attempts) * 60 * 1000 // 2^attempts minutes
        const nextAttempt = new Date(Date.now() + backoffMs)

        await db
          .update(enrichmentQueue)
          .set({
            status: 'pending',
            attempts,
            lastError: errorMsg,
            nextAttemptAt: nextAttempt,
            updatedAt: new Date(),
          })
          .where(eq(enrichmentQueue.id, task.id))
      }

      failed++
    }

    // Update candidate enrichment status
    await updateCandidateEnrichmentStatus(task.candidateId)
  }

  // Get remaining count
  const [remainingResult] = await db
    .select({ count: count() })
    .from(enrichmentQueue)
    .where(
      and(
        eq(enrichmentQueue.companyId, companyId),
        eq(enrichmentQueue.status, 'pending')
      )
    )

  return {
    processed: tasks.length,
    succeeded,
    failed,
    remaining: Number(remainingResult?.count || 0),
  }
}

// =============================================================================
// Task Execution
// =============================================================================

async function executeEnrichmentTask(
  task: typeof enrichmentQueue.$inferSelect
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  // Fetch the candidate for context
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, task.candidateId))
    .limit(1)

  if (!candidate) {
    return { success: false, error: 'Candidate not found' }
  }

  const enrichmentType = task.enrichmentType as EnrichmentType

  switch (enrichmentType) {
    case 'email_find': {
      if (!candidate.firstName || !candidate.currentCompany) {
        return { success: false, error: 'PERMANENT: Missing name or company for email lookup' }
      }
      try {
        const email = await Apollo.findEmail(
          candidate.firstName,
          candidate.lastName,
          candidate.currentCompany
        )
        if (email) {
          return { success: true, data: { email } }
        }
        // "No email found" is a data issue, not transient — mark permanent so it fails immediately
        return { success: false, error: 'PERMANENT: No email found via Apollo' }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown'
        return { success: false, error: `Apollo error: ${msg}` }
      }
    }

    case 'phone_find': {
      if (!candidate.firstName || !candidate.currentCompany) {
        return { success: false, error: 'PERMANENT: Missing name or company for phone lookup' }
      }
      try {
        const phone = await Lusha.findPhone(
          candidate.firstName,
          candidate.lastName,
          candidate.currentCompany
        )
        if (phone) {
          return { success: true, data: { phone } }
        }
        // "No phone found" is a data issue, not transient — mark permanent
        return { success: false, error: 'PERMANENT: No phone found via Lusha' }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown'
        return { success: false, error: `Lusha error: ${msg}` }
      }
    }

    case 'ai_score': {
      try {
        const candidateInfo = `Candidate: ${candidate.firstName} ${candidate.lastName}
Title: ${candidate.currentTitle || 'Unknown'}
Company: ${candidate.currentCompany || 'Unknown'}
Location: ${candidate.location || 'Unknown'}
Experience: ${candidate.experienceYears || 'Unknown'} years
Skills: ${candidate.skills?.join(', ') || 'None listed'}`

        const jobCriteria = `Industry: Construction
Looking for qualified professionals`

        const result = await scoreCandidate(candidateInfo, jobCriteria)
        return {
          success: true,
          data: {
            aiScore: result.score || 50,
            matchReasons: result.reasons || [],
          },
        }
      } catch (err) {
        return { success: false, error: `AI scoring error: ${err instanceof Error ? err.message : 'unknown'}` }
      }
    }

    case 'linkedin_profile': {
      if (!candidate.linkedinUrl) {
        return { success: false, error: 'No LinkedIn URL for profile scraping' }
      }
      try {
        const profileData = await scrapeLinkedInProfile(candidate.linkedinUrl)
        if (profileData) {
          return {
            success: true,
            data: {
              profileImageUrl: profileData.profileImageUrl,
              headline: profileData.headline,
              about: profileData.about,
              experience: profileData.experience,
              education: profileData.education,
              certifications: profileData.certifications,
              skills: profileData.skills,
            },
          }
        }
        return { success: false, error: 'LinkedIn scraper returned no data' }
      } catch (err) {
        return { success: false, error: `LinkedIn scraper error: ${err instanceof Error ? err.message : 'unknown'}` }
      }
    }

    case 'email_verify':
    case 'phone_verify':
    case 'company_info': {
      // These require additional API integrations (ZeroBounce, Twilio, Coresignal)
      // Return skipped for now - they'll be implemented as APIs are configured
      return { success: false, error: `${enrichmentType} not yet implemented` }
    }

    default:
      return { success: false, error: `Unknown enrichment type: ${enrichmentType}` }
  }
}

// =============================================================================
// Apply Results
// =============================================================================

async function applyEnrichmentResult(
  candidateId: string,
  enrichmentType: EnrichmentType,
  data: Record<string, unknown>
): Promise<void> {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
    enrichedAt: new Date(),
  }

  switch (enrichmentType) {
    case 'email_find':
      if (data.email) updateData.email = data.email
      break
    case 'email_verify':
      if (data.deliverability) {
        updateData.emailVerified = data.deliverability === 'deliverable'
        updateData.emailDeliverability = data.deliverability
        updateData.verifiedAt = new Date()
      }
      break
    case 'phone_find':
      if (data.phone) updateData.phone = data.phone
      break
    case 'phone_verify':
      if (data.phoneType) {
        updateData.phoneVerified = true
        updateData.phoneType = data.phoneType
        updateData.verifiedAt = new Date()
      }
      break
    case 'ai_score':
      if (data.aiScore) {
        updateData.aiScore = data.aiScore
        if (data.matchReasons) {
          updateData.aiSummary = (data.matchReasons as string[]).join('; ')
        }
      }
      break
    case 'linkedin_profile':
      if (data.profileImageUrl) updateData.profileImageUrl = data.profileImageUrl
      if (data.headline) updateData.headline = data.headline
      if (data.about) updateData.about = data.about
      if (data.experience) updateData.experience = data.experience
      if (data.education) updateData.education = data.education
      if (data.certifications) updateData.certifications = data.certifications
      updateData.linkedinScrapedAt = new Date()
      updateData.enrichmentSource = 'linkedin_scraper'
      break
    case 'company_info':
      // Apply JSONB data as appropriate
      break
  }

  // Recalculate data completeness
  const [current] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1)

  if (current) {
    const merged = { ...current, ...updateData }
    const fields = [
      merged.email,
      merged.phone,
      merged.currentTitle,
      merged.currentCompany,
      merged.location,
      merged.linkedinUrl,
      (current.skills && current.skills.length > 0) ? 'has_skills' : null,
      merged.profileImageUrl,
      merged.headline,
      merged.about,
      (merged.experience && Array.isArray(merged.experience) && (merged.experience as unknown[]).length > 0) ? 'has_experience' : null,
      (merged.education && Array.isArray(merged.education) && (merged.education as unknown[]).length > 0) ? 'has_education' : null,
    ]
    updateData.dataCompleteness = Math.round(
      (fields.filter(Boolean).length / fields.length) * 100
    )

    // Merge skills from LinkedIn with existing skills
    if (enrichmentType === 'linkedin_profile' && data.skills && Array.isArray(data.skills)) {
      const existingSkills = current.skills || []
      const newSkills = data.skills as string[]
      const combined = new Set([...existingSkills, ...newSkills])
      updateData.skills = Array.from(combined).slice(0, 50)
    }
  }

  await db.update(candidates).set(updateData).where(eq(candidates.id, candidateId))
}

// =============================================================================
// Status Updates
// =============================================================================

async function updateCandidateEnrichmentStatus(candidateId: string): Promise<void> {
  // Count tasks by status for this candidate
  const tasks = await db
    .select({
      status: enrichmentQueue.status,
      count: count(),
    })
    .from(enrichmentQueue)
    .where(eq(enrichmentQueue.candidateId, candidateId))
    .groupBy(enrichmentQueue.status)

  const statusCounts: Record<string, number> = {}
  for (const row of tasks) {
    statusCounts[row.status] = Number(row.count)
  }

  const pending = statusCounts['pending'] || 0
  const inProgress = statusCounts['in_progress'] || 0
  const completed = statusCounts['completed'] || 0
  const failed = statusCounts['failed'] || 0

  let enrichmentStatus: string
  if (pending === 0 && inProgress === 0) {
    enrichmentStatus = failed > 0 && completed === 0 ? 'failed' : 'complete'
  } else if (completed > 0) {
    enrichmentStatus = 'partial'
  } else {
    enrichmentStatus = 'pending'
  }

  await db
    .update(candidates)
    .set({ enrichmentStatus, updatedAt: new Date() })
    .where(eq(candidates.id, candidateId))
}

/**
 * Get enrichment status summary for a company.
 */
export async function getEnrichmentStatus(companyId: string): Promise<EnrichmentStatus> {
  // Queue stats
  const queueStats = await db
    .select({
      status: enrichmentQueue.status,
      count: count(),
    })
    .from(enrichmentQueue)
    .where(eq(enrichmentQueue.companyId, companyId))
    .groupBy(enrichmentQueue.status)

  const statusCounts: Record<string, number> = {}
  for (const row of queueStats) {
    statusCounts[row.status] = Number(row.count)
  }

  // Candidate stats
  const [candidateStats] = await db
    .select({
      total: count(),
      avgCompleteness: sql<number>`coalesce(avg(${candidates.dataCompleteness}), 0)`,
    })
    .from(candidates)
    .where(eq(candidates.companyId, companyId))

  return {
    pending: statusCounts['pending'] || 0,
    inProgress: statusCounts['in_progress'] || 0,
    completed: statusCounts['completed'] || 0,
    failed: statusCounts['failed'] || 0,
    totalCandidates: Number(candidateStats?.total || 0),
    avgCompleteness: Math.round(Number(candidateStats?.avgCompleteness || 0)),
  }
}
