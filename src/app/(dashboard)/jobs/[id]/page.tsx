import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow, format } from 'date-fns'
import {
  ArrowLeft,
  MapPin,
  DollarSign,
  Clock,
  Users,
  Building2,
  Briefcase,
  Pencil,
  Search,
  Mail,
} from 'lucide-react'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { jobs, candidates, campaigns, companyUsers } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface JobDetailPageProps {
  params: Promise<{ id: string }>
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  draft: {
    label: 'Draft',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400',
  },
  closed: {
    label: 'Closed',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
}

function formatSalary(min: number | null, max: number | null, currency: string | null): string {
  const curr = currency ?? 'USD'
  if (min && max) {
    return `${curr} ${min.toLocaleString()} - ${max.toLocaleString()}`
  }
  if (min) {
    return `${curr} ${min.toLocaleString()}+`
  }
  if (max) {
    return `Up to ${curr} ${max.toLocaleString()}`
  }
  return 'Competitive'
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params
  const session = await getSession({ allowGuest: true })

  if (!session) {
    redirect('/login')
  }

  const user = session.user

  // Fetch job details
  const [job] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, id))
    .limit(1)

  if (!job) {
    notFound()
  }

  // Verify user has access to this job's company
  const [companyUser] = await db
    .select({ companyId: companyUsers.companyId })
    .from(companyUsers)
    .where(
      and(
        eq(companyUsers.userId, user.id),
        eq(companyUsers.companyId, job.companyId)
      )
    )
    .limit(1)

  if (!companyUser) {
    notFound()
  }

  // Fetch candidate statistics for this job
  const candidatesList = await db
    .select({ id: candidates.id, status: candidates.status, stage: candidates.stage })
    .from(candidates)
    .where(eq(candidates.jobId, id))

  const totalCandidates = candidatesList.length
  const contactedCount = candidatesList.filter(
    (c) => c.stage !== 'new' && c.stage !== 'applied'
  ).length
  const respondedCount = candidatesList.filter(
    (c) =>
      c.stage === 'responded' ||
      c.stage === 'interview' ||
      c.stage === 'offer' ||
      c.stage === 'hired'
  ).length
  const interviewCount = candidatesList.filter(
    (c) => c.stage === 'interview' || c.stage === 'offer' || c.stage === 'hired'
  ).length

  // Fetch campaigns for this job
  const campaignsList = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      status: campaigns.status,
      totalRecipients: campaigns.totalRecipients,
      totalSent: campaigns.totalSent,
      totalOpened: campaigns.totalOpened,
      totalReplied: campaigns.totalReplied,
    })
    .from(campaigns)
    .where(eq(campaigns.jobId, id))
    .orderBy(desc(campaigns.createdAt))

  const status = statusConfig[job.status] ?? statusConfig.draft

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="size-4" />
          Back to Jobs
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{job.title}</h1>
              <Badge
                variant="secondary"
                className={cn('text-sm', status.className)}
              >
                {status.label}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
              {job.department && (
                <span className="flex items-center gap-1.5 text-sm">
                  <Building2 className="size-4" />
                  {job.department}
                </span>
              )}
              {job.location && (
                <span className="flex items-center gap-1.5 text-sm">
                  <MapPin className="size-4" />
                  {job.location}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-sm">
                <DollarSign className="size-4" />
                {formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}
              </span>
              {job.employmentType && (
                <span className="flex items-center gap-1.5 text-sm">
                  <Briefcase className="size-4" />
                  {job.employmentType}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-sm">
                <Clock className="size-4" />
                Posted {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/jobs/${id}/edit`}>
                <Pencil className="size-4" />
                Edit
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/jobs/${id}/source`}>
                <Search className="size-4" />
                Source Candidates
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={`/jobs/${id}/campaigns/new`}>
                <Mail className="size-4" />
                Create Campaign
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                <Users className="size-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCandidates}</p>
                <p className="text-xs text-muted-foreground">Total Candidates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
                <Mail className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{contactedCount}</p>
                <p className="text-xs text-muted-foreground">Contacted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
                <Users className="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{respondedCount}</p>
                <p className="text-xs text-muted-foreground">Responded</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
                <Briefcase className="size-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{interviewCount}</p>
                <p className="text-xs text-muted-foreground">Interviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="candidates">
            Candidates ({totalCandidates})
          </TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="campaigns">
            Campaigns ({campaignsList.length})
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Job Description</CardTitle>
                </CardHeader>
                <CardContent>
                  {job.description ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {job.description}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No description provided.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Requirements */}
              {job.requirements && job.requirements.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Requirements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {job.requirements.map((req: string, index: number) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <span className="mt-1.5 size-1.5 rounded-full bg-primary shrink-0" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Responsibilities */}
              {job.responsibilities && job.responsibilities.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Responsibilities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {job.responsibilities.map((resp: string, index: number) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <span className="mt-1.5 size-1.5 rounded-full bg-primary shrink-0" />
                          {resp}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Job Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge
                      variant="secondary"
                      className={cn('mt-1', status.className)}
                    >
                      {status.label}
                    </Badge>
                  </div>
                  {job.location && (
                    <div>
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="text-sm font-medium mt-0.5">
                        {job.location}
                      </p>
                    </div>
                  )}
                  {job.employmentType && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Employment Type
                      </p>
                      <p className="text-sm font-medium mt-0.5">
                        {job.employmentType}
                      </p>
                    </div>
                  )}
                  {job.experienceLevel && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Experience Level
                      </p>
                      <p className="text-sm font-medium mt-0.5 capitalize">
                        {job.experienceLevel}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Salary Range</p>
                    <p className="text-sm font-medium mt-0.5">
                      {formatSalary(
                        job.salaryMin,
                        job.salaryMax,
                        job.salaryCurrency
                      )}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-sm font-medium mt-0.5">
                      {format(new Date(job.createdAt), 'PPP')}
                    </p>
                  </div>
                  {job.publishedAt && (
                    <div>
                      <p className="text-xs text-muted-foreground">Published</p>
                      <p className="text-sm font-medium mt-0.5">
                        {format(new Date(job.publishedAt), 'PPP')}
                      </p>
                    </div>
                  )}
                  {job.closesAt && (
                    <div>
                      <p className="text-xs text-muted-foreground">Closes</p>
                      <p className="text-sm font-medium mt-0.5">
                        {format(new Date(job.closesAt), 'PPP')}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Required Skills */}
              {job.skillsRequired && job.skillsRequired.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Required Skills</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {job.skillsRequired.map((skill: string) => (
                        <Badge key={skill} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Preferred Skills */}
              {job.skillsPreferred && job.skillsPreferred.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Nice-to-Have Skills
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {job.skillsPreferred.map((skill: string) => (
                        <Badge key={skill} variant="outline">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Benefits */}
              {job.benefits && job.benefits.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Benefits</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {job.benefits.map((benefit: string, index: number) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-sm"
                        >
                          <span className="mt-1.5 size-1.5 rounded-full bg-emerald-500 shrink-0" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Candidates Tab */}
        <TabsContent value="candidates" className="mt-6">
          {totalCandidates === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Users className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No Candidates Yet</h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-sm text-center">
                  Start sourcing candidates or create a campaign to reach potential hires.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" asChild>
                    <Link href={`/jobs/${id}/source`}>
                      <Search className="size-4" />
                      Source Candidates
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href={`/jobs/${id}/campaigns/new`}>
                      <Mail className="size-4" />
                      Create Campaign
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Candidates</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {totalCandidates} candidate{totalCandidates !== 1 ? 's' : ''} found for this
                  position. View and manage candidates from the candidates section.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Pipeline Tab */}
        <TabsContent value="pipeline" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Hiring Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  {
                    label: 'New / Applied',
                    count: candidatesList.filter(
                      (c) => c.stage === 'new' || c.stage === 'applied'
                    ).length,
                    color: 'bg-blue-500',
                  },
                  {
                    label: 'Screening',
                    count: candidatesList.filter((c) => c.stage === 'screening').length,
                    color: 'bg-amber-500',
                  },
                  {
                    label: 'Interview',
                    count: candidatesList.filter((c) => c.stage === 'interview').length,
                    color: 'bg-purple-500',
                  },
                  {
                    label: 'Offer',
                    count: candidatesList.filter((c) => c.stage === 'offer').length,
                    color: 'bg-emerald-500',
                  },
                  {
                    label: 'Hired',
                    count: candidatesList.filter((c) => c.stage === 'hired').length,
                    color: 'bg-green-600',
                  },
                ].map((stage) => (
                  <div
                    key={stage.label}
                    className="rounded-lg border p-4 text-center"
                  >
                    <div
                      className={cn(
                        'mx-auto mb-2 h-1.5 w-12 rounded-full',
                        stage.color
                      )}
                    />
                    <p className="text-2xl font-bold">{stage.count}</p>
                    <p className="text-xs text-muted-foreground">{stage.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="mt-6">
          {campaignsList.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Mail className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No Campaigns</h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-sm text-center">
                  Create an email campaign to reach out to potential candidates for this role.
                </p>
                <Button asChild>
                  <Link href={`/jobs/${id}/campaigns/new`}>
                    <Mail className="size-4" />
                    Create Campaign
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {campaignsList.map((campaign) => (
                <Card key={campaign.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{campaign.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {campaign.totalRecipients} recipients
                        </p>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <p className="font-semibold">{campaign.totalSent}</p>
                          <p className="text-xs text-muted-foreground">Sent</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold">{campaign.totalOpened}</p>
                          <p className="text-xs text-muted-foreground">Opened</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold">{campaign.totalReplied}</p>
                          <p className="text-xs text-muted-foreground">Replied</p>
                        </div>
                        <Badge
                          variant="secondary"
                          className={cn(
                            campaign.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : campaign.status === 'draft'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-blue-100 text-blue-800'
                          )}
                        >
                          {campaign.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
