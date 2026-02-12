import { desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  candidateReachOuts,
  candidates,
  companies,
  interviews,
  jobs,
} from '@/lib/db/schema'
import { resolveCandidateWorkspaceStatus } from '@/lib/candidate/workspace-lifecycle'

export interface CandidateWorkspaceOpportunity {
  interviewId: string
  candidateId: string
  companyId: string
  companyName: string
  jobId: string | null
  jobTitle: string | null
  interviewStatus: string
  candidateStage: string | null
  scheduledAt: Date | null
  expiresAt: Date | null
  lifecycleStatus: ReturnType<typeof resolveCandidateWorkspaceStatus>
  aiScore: number | null
  aiSummary: string | null
  aiSentimentScore: number | null
  portalToken: string | null
}

export interface CandidateWorkspaceData {
  opportunities: CandidateWorkspaceOpportunity[]
  unreadReachOutCount: number
  totalReachOutCount: number
}

export async function getCandidateWorkspaceData(input: {
  candidateUserId: string
  candidateEmail: string
}): Promise<CandidateWorkspaceData> {
  const normalizedEmail = input.candidateEmail.trim().toLowerCase()

  const candidateRows = await db
    .select({
      id: candidates.id,
    })
    .from(candidates)
    .where(sql`LOWER(${candidates.email}) = ${normalizedEmail}`)

  const candidateIds = candidateRows.map((row) => row.id)

  const opportunityRows = candidateIds.length > 0
    ? await db
      .select({
        interviewId: interviews.id,
        candidateId: candidates.id,
        companyId: companies.id,
        companyName: companies.name,
        jobId: jobs.id,
        jobTitle: jobs.title,
        interviewStatus: interviews.status,
        candidateStage: candidates.stage,
        scheduledAt: interviews.scheduledAt,
        expiresAt: interviews.candidatePortalExpiresAt,
        aiScore: candidates.aiScore,
        aiSummary: interviews.aiSummary,
        aiSentimentScore: interviews.aiSentimentScore,
        portalToken: interviews.candidatePortalToken,
      })
      .from(interviews)
      .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
      .innerJoin(companies, eq(interviews.companyId, companies.id))
      .leftJoin(jobs, eq(interviews.jobId, jobs.id))
      .where(inArray(interviews.candidateId, candidateIds))
      .orderBy(desc(interviews.scheduledAt))
    : []

  const opportunities: CandidateWorkspaceOpportunity[] = opportunityRows.map((row) => ({
    ...row,
    lifecycleStatus: resolveCandidateWorkspaceStatus({
      interviewStatus: row.interviewStatus,
      candidateStage: row.candidateStage,
      scheduledAt: row.scheduledAt,
      expiresAt: row.expiresAt,
    }),
  }))

  const reachOutCounts = await db
    .select({
      total: sql<number>`count(*)::int`,
      unread: sql<number>`count(*) FILTER (WHERE ${candidateReachOuts.status} = 'sent')::int`,
    })
    .from(candidateReachOuts)
    .where(eq(candidateReachOuts.candidateId, input.candidateUserId))

  const [countRow] = reachOutCounts

  return {
    opportunities,
    unreadReachOutCount: countRow?.unread ?? 0,
    totalReachOutCount: countRow?.total ?? 0,
  }
}
