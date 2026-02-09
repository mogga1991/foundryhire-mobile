/**
 * Candidate Deduplication Service
 *
 * Prevents duplicate candidates within a company by matching on:
 * 1. Email (exact match - strongest signal)
 * 2. LinkedIn URL (exact match after normalization)
 * 3. Name + Company (fuzzy match - weakest signal)
 *
 * Supports three merge strategies:
 * - keep_existing: Skip the new data, keep what's in the DB
 * - prefer_new: Overwrite existing fields with new data
 * - merge_best: Pick the best (non-null) value for each field
 */

import { db } from '@/lib/db'
import { candidates } from '@/lib/db/schema'
import { eq, and, or, sql, ilike } from 'drizzle-orm'

// =============================================================================
// Types
// =============================================================================

export type MergeStrategy = 'keep_existing' | 'prefer_new' | 'merge_best'

export interface DeduplicationResult {
  action: 'insert' | 'update' | 'skip'
  candidateId: string | null
  reason: string
}

export interface CandidateInput {
  companyId: string
  jobId?: string | null
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  linkedinUrl?: string | null
  githubUrl?: string | null
  portfolioUrl?: string | null
  currentTitle?: string | null
  currentCompany?: string | null
  location?: string | null
  experienceYears?: number | null
  skills?: string[] | null
  source?: string | null
  stage?: string
  aiScore?: number | null
  enrichmentSource?: string | null
  dataCompleteness?: number | null
  socialProfiles?: Record<string, unknown> | null
  companyInfo?: Record<string, unknown> | null
  headline?: string | null
}

// =============================================================================
// Normalization Helpers
// =============================================================================

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

export function normalizeLinkedInUrl(url: string): string {
  return url
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .replace(/\?.*$/, '')
}

// =============================================================================
// Find Existing Candidate
// =============================================================================

/**
 * Find an existing candidate that matches the input within a company.
 * Match priority: email > LinkedIn URL > name+company
 */
export async function findExistingCandidate(
  companyId: string,
  input: {
    email?: string | null
    linkedinUrl?: string | null
    firstName: string
    lastName: string
    currentCompany?: string | null
  }
): Promise<{ id: string; email: string | null; matchedOn: string } | null> {
  // 1. Try exact email match (strongest)
  if (input.email) {
    const normalized = normalizeEmail(input.email)
    const [match] = await db
      .select({ id: candidates.id, email: candidates.email })
      .from(candidates)
      .where(
        and(
          eq(candidates.companyId, companyId),
          eq(sql`lower(${candidates.email})`, normalized)
        )
      )
      .limit(1)

    if (match) {
      return { id: match.id, email: match.email, matchedOn: 'email' }
    }
  }

  // 2. Try LinkedIn URL match
  if (input.linkedinUrl) {
    const normalized = normalizeLinkedInUrl(input.linkedinUrl)
    const [match] = await db
      .select({ id: candidates.id, email: candidates.email })
      .from(candidates)
      .where(
        and(
          eq(candidates.companyId, companyId),
          sql`lower(replace(replace(replace(replace(${candidates.linkedinUrl}, 'https://', ''), 'http://', ''), 'www.', ''), '/', '')) = ${normalized.replace(/\//g, '')}`
        )
      )
      .limit(1)

    if (match) {
      return { id: match.id, email: match.email, matchedOn: 'linkedin' }
    }
  }

  // 3. Try name + company match (weakest - only if company is known)
  if (input.firstName && input.lastName && input.currentCompany) {
    const [match] = await db
      .select({ id: candidates.id, email: candidates.email })
      .from(candidates)
      .where(
        and(
          eq(candidates.companyId, companyId),
          ilike(candidates.firstName, input.firstName.trim()),
          ilike(candidates.lastName, input.lastName.trim()),
          ilike(candidates.currentCompany, input.currentCompany.trim())
        )
      )
      .limit(1)

    if (match) {
      return { id: match.id, email: match.email, matchedOn: 'name_company' }
    }
  }

  return null
}

// =============================================================================
// Merge Logic
// =============================================================================

function pickBest<T>(existing: T | null | undefined, incoming: T | null | undefined): T | null | undefined {
  if (incoming !== null && incoming !== undefined && incoming !== '') return incoming
  return existing
}

function pickHigher(existing: number | null | undefined, incoming: number | null | undefined): number | null | undefined {
  if (existing === null || existing === undefined) return incoming
  if (incoming === null || incoming === undefined) return existing
  return Math.max(existing, incoming)
}

function mergeArrays(existing: string[] | null | undefined, incoming: string[] | null | undefined): string[] | null {
  if (!existing?.length && !incoming?.length) return null
  const combined = new Set([...(existing || []), ...(incoming || [])])
  return Array.from(combined)
}

function mergeJsonb(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!existing && !incoming) return null
  return { ...(existing || {}), ...(incoming || {}) }
}

// =============================================================================
// Upsert Candidate
// =============================================================================

/**
 * Insert a new candidate or update an existing one based on deduplication rules.
 */
export async function upsertCandidate(
  companyId: string,
  data: CandidateInput,
  mergeStrategy: MergeStrategy = 'merge_best'
): Promise<DeduplicationResult> {
  const normalizedEmail = data.email ? normalizeEmail(data.email) : null

  // Check for existing candidate
  const existing = await findExistingCandidate(companyId, {
    email: data.email,
    linkedinUrl: data.linkedinUrl,
    firstName: data.firstName,
    lastName: data.lastName,
    currentCompany: data.currentCompany,
  })

  // No match - insert new candidate
  if (!existing) {
    try {
      const [inserted] = await db
        .insert(candidates)
        .values({
          companyId,
          jobId: data.jobId || null,
          firstName: data.firstName,
          lastName: data.lastName,
          email: normalizedEmail,
          phone: data.phone || null,
          linkedinUrl: data.linkedinUrl || null,
          githubUrl: data.githubUrl || null,
          portfolioUrl: data.portfolioUrl || null,
          currentTitle: data.currentTitle || null,
          currentCompany: data.currentCompany || null,
          location: data.location || null,
          experienceYears: data.experienceYears || null,
          skills: data.skills || null,
          source: data.source || 'manual',
          stage: data.stage || 'sourced',
          aiScore: data.aiScore || null,
          enrichmentSource: data.enrichmentSource || null,
          dataCompleteness: data.dataCompleteness || null,
          socialProfiles: data.socialProfiles || null,
          companyInfo: data.companyInfo || null,
          headline: data.headline || null,
          enrichmentStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: candidates.id })

      if (inserted) {
        return { action: 'insert', candidateId: inserted.id, reason: 'new_candidate' }
      }

      return { action: 'skip', candidateId: null, reason: 'insert_failed' }
    } catch (error: unknown) {
      // Handle unique constraint violation (race condition on email or LinkedIn URL)
      if (error instanceof Error && error.message.includes('unique')) {
        // Try to find the conflicting record
        const conflictMatch = await findExistingCandidate(companyId, {
          email: data.email,
          linkedinUrl: data.linkedinUrl,
          firstName: data.firstName,
          lastName: data.lastName,
          currentCompany: data.currentCompany,
        })

        if (conflictMatch) {
          return await updateExisting(conflictMatch.id, companyId, data, mergeStrategy)
        }
      }
      throw error
    }
  }

  // Match found - apply merge strategy
  if (mergeStrategy === 'keep_existing') {
    return {
      action: 'skip',
      candidateId: existing.id,
      reason: `duplicate_${existing.matchedOn}`,
    }
  }

  return await updateExisting(existing.id, companyId, data, mergeStrategy)
}

async function updateExisting(
  existingId: string,
  companyId: string,
  data: CandidateInput,
  mergeStrategy: MergeStrategy
): Promise<DeduplicationResult> {
  // Fetch current values for merge
  const [current] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, existingId))
    .limit(1)

  if (!current) {
    return { action: 'skip', candidateId: existingId, reason: 'existing_not_found' }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() }

  if (mergeStrategy === 'prefer_new') {
    // Overwrite all fields with new data (where provided)
    if (data.email && !current.email) updateData.email = normalizeEmail(data.email)
    if (data.phone) updateData.phone = data.phone
    if (data.linkedinUrl) updateData.linkedinUrl = data.linkedinUrl
    if (data.githubUrl) updateData.githubUrl = data.githubUrl
    if (data.currentTitle) updateData.currentTitle = data.currentTitle
    if (data.currentCompany) updateData.currentCompany = data.currentCompany
    if (data.location) updateData.location = data.location
    if (data.experienceYears) updateData.experienceYears = data.experienceYears
    if (data.skills?.length) updateData.skills = data.skills
    if (data.aiScore) updateData.aiScore = data.aiScore
    if (data.enrichmentSource) updateData.enrichmentSource = data.enrichmentSource
    if (data.dataCompleteness) updateData.dataCompleteness = data.dataCompleteness
    if (data.socialProfiles) updateData.socialProfiles = data.socialProfiles
    if (data.companyInfo) updateData.companyInfo = data.companyInfo
    if (data.headline) updateData.headline = data.headline
  } else {
    // merge_best: pick the best non-null value for each field
    if (data.email) updateData.email = pickBest(current.email, normalizeEmail(data.email))
    updateData.phone = pickBest(current.phone, data.phone)
    updateData.linkedinUrl = pickBest(current.linkedinUrl, data.linkedinUrl)
    updateData.githubUrl = pickBest(current.githubUrl, data.githubUrl)
    updateData.currentTitle = pickBest(current.currentTitle, data.currentTitle)
    updateData.currentCompany = pickBest(current.currentCompany, data.currentCompany)
    updateData.location = pickBest(current.location, data.location)
    updateData.experienceYears = pickBest(current.experienceYears, data.experienceYears)
    updateData.skills = mergeArrays(current.skills, data.skills)
    updateData.aiScore = pickHigher(current.aiScore, data.aiScore)
    updateData.dataCompleteness = pickHigher(current.dataCompleteness, data.dataCompleteness)
    updateData.socialProfiles = mergeJsonb(
      current.socialProfiles as Record<string, unknown> | null,
      data.socialProfiles
    )
    updateData.companyInfo = mergeJsonb(
      current.companyInfo as Record<string, unknown> | null,
      data.companyInfo
    )
    updateData.headline = pickBest(current.headline, data.headline)
    if (data.enrichmentSource && data.enrichmentSource !== current.enrichmentSource) {
      updateData.enrichmentSource = [current.enrichmentSource, data.enrichmentSource]
        .filter(Boolean)
        .join(', ')
    }
  }

  // Associate with job if not already associated
  if (data.jobId && !current.jobId) {
    updateData.jobId = data.jobId
  }

  await db
    .update(candidates)
    .set(updateData)
    .where(eq(candidates.id, existingId))

  return {
    action: 'update',
    candidateId: existingId,
    reason: `merged_${mergeStrategy}`,
  }
}

// =============================================================================
// Batch Deduplication
// =============================================================================

/**
 * Process an array of candidates with deduplication.
 * Returns an array of results (one per input candidate).
 */
export async function deduplicateBatch(
  companyId: string,
  candidateInputs: CandidateInput[],
  mergeStrategy: MergeStrategy = 'merge_best'
): Promise<{
  results: DeduplicationResult[]
  stats: { inserted: number; updated: number; skipped: number; errors: number }
}> {
  const results: DeduplicationResult[] = []
  const stats = { inserted: 0, updated: 0, skipped: 0, errors: 0 }

  for (const input of candidateInputs) {
    try {
      const result = await upsertCandidate(companyId, input, mergeStrategy)
      results.push(result)

      if (result.action === 'insert') stats.inserted++
      else if (result.action === 'update') stats.updated++
      else stats.skipped++
    } catch (error) {
      console.error(`[Dedup] Error processing ${input.firstName} ${input.lastName}:`, error)
      results.push({
        action: 'skip',
        candidateId: null,
        reason: `error: ${error instanceof Error ? error.message : 'unknown'}`,
      })
      stats.errors++
    }
  }

  return { results, stats }
}
