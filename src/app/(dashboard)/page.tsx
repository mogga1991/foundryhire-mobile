import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { jobs, candidates, campaigns, companyUsers } from '@/lib/db/schema'
import { eq, and, isNotNull, desc, sum } from 'drizzle-orm'
import { formatDistanceToNow } from 'date-fns'
import {
  Briefcase,
  Plus,
  Search,
  Users,
  MapPin,
  Clock,
  ArrowRight,
  Sparkles,
  TrendingUp,
  FileText,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Dashboard | VerticalHire',
  description: 'Your recruiting dashboard',
}

const statusConfig: Record<
  string,
  { label: string; className: string; dotColor: string }
> = {
  active: {
    label: 'Active',
    className:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
  },
  draft: {
    label: 'Draft',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400',
    dotColor: 'bg-gray-400',
  },
  closed: {
    label: 'Closed',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    dotColor: 'bg-red-500',
  },
}

export default async function DashboardHomePage() {
  const session = await getSession({ allowGuest: true })

  if (!session) {
    redirect('/login')
  }

  const user = session.user

  // Get the user's company
  const [companyUser] = await db
    .select({ companyId: companyUsers.companyId })
    .from(companyUsers)
    .where(eq(companyUsers.userId, user.id))
    .limit(1)

  // User's first name for greeting
  const fullName = user.name ?? user.email ?? 'there'
  const firstName = fullName.split(' ')[0]

  let recentJobs: any[] = []
  let candidateCounts: Record<string, number> = {}
  let totalJobs = 0
  let totalCandidates = 0
  let emailsFound = 0
  let responseRate = 0

  if (companyUser) {
    // Fetch recent jobs (last 5)
    recentJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.companyId, companyUser.companyId))
      .orderBy(desc(jobs.createdAt))
      .limit(5)

    // Fetch all jobs for stats
    const allJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.companyId, companyUser.companyId))

    totalJobs = allJobs.length

    // Fetch candidate counts per job
    const candidatesRaw = await db
      .select({ jobId: candidates.jobId, email: candidates.email })
      .from(candidates)
      .where(
        and(
          eq(candidates.companyId, companyUser.companyId),
          isNotNull(candidates.jobId)
        )
      )

    for (const c of candidatesRaw) {
      if (c.jobId) {
        candidateCounts[c.jobId] = (candidateCounts[c.jobId] ?? 0) + 1
      }
      if (c.email) {
        emailsFound++
      }
    }

    totalCandidates = candidatesRaw.length

    // Real response rate calculation from campaigns
    const campaignStatsResult = await db
      .select({
        totalSent: sum(campaigns.totalSent),
        totalReplied: sum(campaigns.totalReplied),
      })
      .from(campaigns)
      .where(eq(campaigns.companyId, companyUser.companyId))

    const sent = Number(campaignStatsResult[0]?.totalSent ?? 0)
    const replied = Number(campaignStatsResult[0]?.totalReplied ?? 0)
    responseRate = sent > 0 ? Math.round((replied / sent) * 100) : 0
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 animate-fade-in-up">
      {/* Hero Section */}
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Hey {firstName}
        </h1>
        <p className="text-lg text-muted-foreground">
          How would you like to start?
        </p>
      </div>

      {/* Quick Action Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Card 1: Create New Job */}
        <Link href="/jobs/new" className="group">
          <Card className="h-full transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer border-2 hover:border-primary/20">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 shadow-lg group-hover:shadow-xl transition-shadow">
                <Plus className="w-7 h-7 text-white" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                  Create New Job
                </h3>
                <p className="text-sm text-muted-foreground">
                  Upload job doc or create manually
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 2: Find Candidates */}
        <Link href="/jobs" className="group">
          <Card className="h-full transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer border-2 hover:border-primary/20">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg group-hover:shadow-xl transition-shadow">
                <Search className="w-7 h-7 text-white" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                  Find Candidates
                </h3>
                <p className="text-sm text-muted-foreground">
                  Generate leads for existing jobs
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 3: View Leads */}
        <Link href="/candidates" className="group">
          <Card className="h-full transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer border-2 hover:border-primary/20">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg group-hover:shadow-xl transition-shadow">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                  View Leads
                </h3>
                <p className="text-sm text-muted-foreground">
                  Browse and manage your candidates
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stats Overview */}
      {companyUser && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Jobs
                  </p>
                  <p className="text-3xl font-bold">{totalJobs}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Briefcase className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Candidates
                  </p>
                  <p className="text-3xl font-bold">{totalCandidates}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Emails Found
                  </p>
                  <p className="text-3xl font-bold">{emailsFound}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Sparkles className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Response Rate
                  </p>
                  <p className="text-3xl font-bold">{responseRate}%</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10">
                  <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Jobs Section */}
      {companyUser && recentJobs.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold tracking-tight">Recent Jobs</h2>
            <Link href="/jobs">
              <Button variant="ghost" size="sm" className="gap-2">
                View all
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentJobs.map((job) => {
              const status = statusConfig[job.status] ?? statusConfig.draft
              const postedAgo = formatDistanceToNow(new Date(job.createdAt), {
                addSuffix: true,
              })
              const candidateCount = candidateCounts[job.id] ?? 0

              return (
                <Link key={job.id} href={`/jobs/${job.id}`}>
                  <Card className="group h-full transition-all duration-200 hover:shadow-md hover:border-primary/20 cursor-pointer">
                    <CardContent className="p-6 space-y-4">
                      {/* Header */}
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                            {job.title}
                          </h3>
                          <Badge
                            variant="secondary"
                            className={`shrink-0 ${status.className}`}
                          >
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${status.dotColor} mr-1.5`}
                            />
                            {status.label}
                          </Badge>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-2">
                        {job.location && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{job.location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {candidateCount}{' '}
                            {candidateCount === 1 ? 'candidate' : 'candidates'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          <span>{postedAgo}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      ) : companyUser && recentJobs.length === 0 ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Recent Jobs</h2>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 mb-6">
                <FileText className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No jobs yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                Get started by creating your first job posting to begin finding
                great candidates.
              </p>
              <Link href="/jobs/new">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Your First Job
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Get Started</h2>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 mb-6">
                <Briefcase className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Set up your company profile
              </h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                Configure your company settings to start creating job postings and
                finding candidates.
              </p>
              <Link href="/settings/company">
                <Button>Go to Company Settings</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
