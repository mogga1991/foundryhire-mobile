import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  jobs,
  candidates,
  campaigns,
  candidateActivities,
  companyUsers,
} from '@/lib/db/schema'
import { eq, and, count, sum, sql, desc, gte } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatsGrid, type StatItem } from '@/components/dashboard/stats-grid'
import {
  ActivityTimeline,
  type ActivityItem,
  type ActivityType,
} from '@/components/dashboard/activity-timeline'
import { QuickActions } from '@/components/dashboard/quick-actions'
import {
  TopCandidates,
  type TopCandidateItem,
} from '@/components/dashboard/top-candidates'
import {
  CampaignPerformance,
  type CampaignPerformanceItem,
} from '@/components/dashboard/campaign-performance'
import { Trophy, BarChart3 } from 'lucide-react'

export const metadata = {
  title: 'Dashboard - VerticalHire',
  description: 'Your VerticalHire recruiting dashboard',
}

async function getDashboardData(companyId: string) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const [
    activeJobsResult,
    activeJobsLastMonthResult,
    candidatesResult,
    candidatesLastMonthResult,
    campaignStatsResult,
    campaignStatsLastMonthResult,
    interviewsResult,
    interviewsLastMonthResult,
    recentActivitiesResult,
    topCandidatesResult,
    campaignPerformanceResult,
  ] = await Promise.all([
    // Active jobs this month
    db
      .select({ count: count() })
      .from(jobs)
      .where(and(eq(jobs.companyId, companyId), eq(jobs.status, 'active'))),

    // Active jobs created before this month (to compare)
    db
      .select({ count: count() })
      .from(jobs)
      .where(
        and(
          eq(jobs.companyId, companyId),
          eq(jobs.status, 'active'),
          gte(jobs.createdAt, startOfLastMonth),
          sql`${jobs.createdAt} < ${startOfMonth}`
        )
      ),

    // Total candidates this month
    db
      .select({ count: count() })
      .from(candidates)
      .where(
        and(
          eq(candidates.companyId, companyId),
          gte(candidates.createdAt, startOfMonth)
        )
      ),

    // Total candidates last month
    db
      .select({ count: count() })
      .from(candidates)
      .where(
        and(
          eq(candidates.companyId, companyId),
          gte(candidates.createdAt, startOfLastMonth),
          sql`${candidates.createdAt} < ${startOfMonth}`
        )
      ),

    // Campaign stats (total sent & replied) this month
    db
      .select({
        totalSent: sum(campaigns.totalSent),
        totalReplied: sum(campaigns.totalReplied),
      })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.companyId, companyId),
          gte(campaigns.createdAt, startOfMonth)
        )
      ),

    // Campaign stats last month
    db
      .select({
        totalSent: sum(campaigns.totalSent),
        totalReplied: sum(campaigns.totalReplied),
      })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.companyId, companyId),
          gte(campaigns.createdAt, startOfLastMonth),
          sql`${campaigns.createdAt} < ${startOfMonth}`
        )
      ),

    // Interviews (candidates in interview stage)
    db
      .select({ count: count() })
      .from(candidates)
      .where(
        and(
          eq(candidates.companyId, companyId),
          eq(candidates.stage, 'interview')
        )
      ),

    // Interviews last month
    db
      .select({ count: count() })
      .from(candidates)
      .where(
        and(
          eq(candidates.companyId, companyId),
          eq(candidates.stage, 'interview'),
          gte(candidates.updatedAt, startOfLastMonth),
          sql`${candidates.updatedAt} < ${startOfMonth}`
        )
      ),

    // Recent activities (last 10)
    db
      .select({
        id: candidateActivities.id,
        activityType: candidateActivities.activityType,
        title: candidateActivities.title,
        description: candidateActivities.description,
        createdAt: candidateActivities.createdAt,
      })
      .from(candidateActivities)
      .where(eq(candidateActivities.companyId, companyId))
      .orderBy(desc(candidateActivities.createdAt))
      .limit(10),

    // Top candidates by AI score
    db
      .select({
        id: candidates.id,
        firstName: candidates.firstName,
        lastName: candidates.lastName,
        currentTitle: candidates.currentTitle,
        aiScore: candidates.aiScore,
      })
      .from(candidates)
      .where(
        and(
          eq(candidates.companyId, companyId),
          sql`${candidates.aiScore} IS NOT NULL`
        )
      )
      .orderBy(desc(candidates.aiScore))
      .limit(3),

    // Campaign performance (active/completed campaigns with stats)
    db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        totalSent: campaigns.totalSent,
        totalReplied: campaigns.totalReplied,
      })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.companyId, companyId),
          sql`${campaigns.totalSent} > 0`
        )
      )
      .orderBy(desc(campaigns.createdAt))
      .limit(3),
  ])

  // Calculate stats
  const activeJobs = activeJobsResult[0]?.count ?? 0
  const activeJobsLast = activeJobsLastMonthResult[0]?.count ?? 0

  const candidatesThisMonth = candidatesResult[0]?.count ?? 0
  const candidatesLastMonth = candidatesLastMonthResult[0]?.count ?? 0

  const sent = Number(campaignStatsResult[0]?.totalSent ?? 0)
  const replied = Number(campaignStatsResult[0]?.totalReplied ?? 0)
  const responseRate = sent > 0 ? Math.round((replied / sent) * 100) : 0

  const sentLast = Number(campaignStatsLastMonthResult[0]?.totalSent ?? 0)
  const repliedLast = Number(campaignStatsLastMonthResult[0]?.totalReplied ?? 0)
  const responseRateLast =
    sentLast > 0 ? Math.round((repliedLast / sentLast) * 100) : 0

  const interviews = interviewsResult[0]?.count ?? 0
  const interviewsLast = interviewsLastMonthResult[0]?.count ?? 0

  return {
    activeJobs,
    activeJobsLast,
    candidatesThisMonth,
    candidatesLastMonth,
    responseRate,
    responseRateLast,
    interviews,
    interviewsLast,
    recentActivities: recentActivitiesResult,
    topCandidates: topCandidatesResult,
    campaignPerformance: campaignPerformanceResult,
  }
}

function formatChange(current: number, previous: number): { change: string; trend: 'up' | 'down' | 'neutral' } {
  const diff = current - previous
  if (diff === 0) return { change: '+0', trend: 'neutral' }
  if (diff > 0) return { change: `+${diff}`, trend: 'up' }
  return { change: `${diff}`, trend: 'down' }
}

function formatPercentChange(current: number, previous: number): { change: string; trend: 'up' | 'down' | 'neutral' } {
  const diff = current - previous
  if (diff === 0) return { change: '+0%', trend: 'neutral' }
  if (diff > 0) return { change: `+${diff}%`, trend: 'up' }
  return { change: `${diff}%`, trend: 'down' }
}

const activityTypeMap: Record<string, ActivityType> = {
  candidate_added: 'candidate_added',
  campaign_sent: 'campaign_sent',
  email_replied: 'email_replied',
  status_changed: 'status_changed',
  job_created: 'job_created',
}

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const user = session.user

  // Get company for current user
  const [companyUser] = await db
    .select()
    .from(companyUsers)
    .where(eq(companyUsers.userId, user.id))
    .limit(1)

  // User's first name for greeting
  const fullName = user.name ?? user.email ?? 'there'
  const firstName = fullName.split(' ')[0]

  // If no company yet, show empty dashboard
  if (!companyUser) {
    const emptyStats: StatItem[] = [
      { title: 'Active Jobs', value: 0, change: '+0', trend: 'neutral', iconName: 'briefcase' },
      { title: 'Candidates Sourced', value: 0, change: '+0', trend: 'neutral', iconName: 'users' },
      { title: 'Response Rate', value: '0%', change: '+0%', trend: 'neutral', iconName: 'mail' },
      { title: 'Interviews Scheduled', value: 0, change: '+0', trend: 'neutral', iconName: 'calendar' },
    ]

    return (
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back, {firstName}. Set up your company in{' '}
            <a href="/settings/company" className="text-primary hover:underline">Settings</a>{' '}
            to get started.
          </p>
        </div>
        <StatsGrid stats={emptyStats} />
      </div>
    )
  }

  const data = await getDashboardData(companyUser.companyId)

  const jobChange = formatChange(data.activeJobs, data.activeJobsLast)
  const candidateChange = formatChange(data.candidatesThisMonth, data.candidatesLastMonth)
  const responseChange = formatPercentChange(data.responseRate, data.responseRateLast)
  const interviewChange = formatChange(data.interviews, data.interviewsLast)

  const stats: StatItem[] = [
    {
      title: 'Active Jobs',
      value: data.activeJobs,
      change: jobChange.change,
      trend: jobChange.trend,
      iconName: 'briefcase',
    },
    {
      title: 'Candidates Sourced',
      value: data.candidatesThisMonth,
      change: candidateChange.change,
      trend: candidateChange.trend,
      iconName: 'users',
    },
    {
      title: 'Response Rate',
      value: `${data.responseRate}%`,
      change: responseChange.change,
      trend: responseChange.trend,
      iconName: 'mail',
    },
    {
      title: 'Interviews Scheduled',
      value: data.interviews,
      change: interviewChange.change,
      trend: interviewChange.trend,
      iconName: 'calendar',
    },
  ]

  // Map DB activities to ActivityItem format
  const activities: ActivityItem[] = data.recentActivities.map((a) => ({
    id: a.id,
    type: activityTypeMap[a.activityType] ?? 'status_changed',
    description: a.title,
    timestamp: a.createdAt.toISOString(),
  }))

  // Map top candidates
  const topCandidates: TopCandidateItem[] = data.topCandidates.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
    title: c.currentTitle ?? 'No title',
    score: c.aiScore ?? 0,
  }))

  // Map campaign performance
  const campaignPerformance: CampaignPerformanceItem[] =
    data.campaignPerformance.map((c) => {
      const sent = c.totalSent ?? 0
      const replied = c.totalReplied ?? 0
      return {
        id: c.id,
        name: c.name,
        responseRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
      }
    })

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back, {firstName}. Here is what is happening with your
          recruiting pipeline.
        </p>
      </div>

      {/* Stats */}
      <StatsGrid stats={stats} />

      {/* Top Candidates & Campaign Performance */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Top Candidates</CardTitle>
            <Trophy className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <TopCandidates candidates={topCandidates} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Campaign Performance</CardTitle>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CampaignPerformance campaigns={campaignPerformance} />
          </CardContent>
        </Card>
      </div>

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Activity timeline - takes 2 columns */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityTimeline activities={activities} />
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <QuickActions />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
