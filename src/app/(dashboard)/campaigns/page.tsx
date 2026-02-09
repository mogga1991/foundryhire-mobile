import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Mail, Send, Users, TrendingUp, Plus } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { campaigns, jobs, companyUsers } from '@/lib/db/schema'
import { eq, desc, count, sum } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

export const metadata = {
  title: 'Campaigns | VerticalHire',
  description: 'View and manage all your email campaigns',
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  completed: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
}

export default async function CampaignsPage() {
  const session = await getSession()

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

  if (!companyUser) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Mail className="size-8" />
              Campaigns
            </h1>
            <p className="text-muted-foreground mt-1">
              View and manage all your email campaigns across jobs.
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Mail className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No company set up yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Set up your company profile in settings to start creating campaigns.
            </p>
            <Link href="/settings/company">
              <Button>Go to Company Settings</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Fetch all campaigns for this company with their job titles
  const campaignsList = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      status: campaigns.status,
      totalRecipients: campaigns.totalRecipients,
      totalSent: campaigns.totalSent,
      totalOpened: campaigns.totalOpened,
      totalClicked: campaigns.totalClicked,
      totalReplied: campaigns.totalReplied,
      createdAt: campaigns.createdAt,
      scheduledAt: campaigns.scheduledAt,
      jobId: campaigns.jobId,
      jobTitle: jobs.title,
    })
    .from(campaigns)
    .leftJoin(jobs, eq(campaigns.jobId, jobs.id))
    .where(eq(campaigns.companyId, companyUser.companyId))
    .orderBy(desc(campaigns.createdAt))
    .limit(100)

  // Get overall stats
  const statsResult = await db
    .select({
      totalCampaigns: count(),
      totalSent: sum(campaigns.totalSent),
      totalOpened: sum(campaigns.totalOpened),
      totalReplied: sum(campaigns.totalReplied),
    })
    .from(campaigns)
    .where(eq(campaigns.companyId, companyUser.companyId))

  const stats = statsResult[0] || {
    totalCampaigns: 0,
    totalSent: 0,
    totalOpened: 0,
    totalReplied: 0,
  }

  const totalSent = Number(stats.totalSent || 0)
  const totalOpened = Number(stats.totalOpened || 0)
  const totalReplied = Number(stats.totalReplied || 0)
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0
  const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0

  // Get first job for "Create Campaign" link
  const [firstJob] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.companyId, companyUser.companyId))
    .limit(1)

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Mail className="size-8" />
            Campaigns
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage all your email campaigns across jobs.
          </p>
        </div>
        {firstJob && (
          <Link href={`/jobs/${firstJob.id}/campaigns/new`}>
            <Button size="lg">
              <Plus className="size-4" />
              Create Campaign
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCampaigns}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSent}</div>
            <p className="text-xs text-muted-foreground">Across all campaigns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openRate}%</div>
            <p className="text-xs text-muted-foreground">{totalOpened} opened</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{replyRate}%</div>
            <p className="text-xs text-muted-foreground">{totalReplied} replied</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      {campaignsList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Mail className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Create your first email campaign to start reaching out to candidates.
            </p>
            {firstJob ? (
              <Link href={`/jobs/${firstJob.id}/campaigns/new`}>
                <Button>Create Your First Campaign</Button>
              </Link>
            ) : (
              <Link href="/jobs/new">
                <Button>Create a Job First</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaignsList.map((campaign) => {
            const statusColor = statusColors[campaign.status] || statusColors.draft
            const statusLabel = statusLabels[campaign.status] || campaign.status
            const sent = campaign.totalSent || 0
            const recipients = campaign.totalRecipients || 0
            const progressPercent = recipients > 0 ? Math.round((sent / recipients) * 100) : 0
            const opened = campaign.totalOpened || 0
            const replied = campaign.totalReplied || 0
            const campaignOpenRate = sent > 0 ? Math.round((opened / sent) * 100) : 0
            const campaignReplyRate = sent > 0 ? Math.round((replied / sent) * 100) : 0

            return (
              <Link
                key={campaign.id}
                href={campaign.jobId ? `/jobs/${campaign.jobId}/campaigns/${campaign.id}` : '#'}
              >
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg truncate">
                              {campaign.name}
                            </h3>
                            <Badge className={statusColor}>
                              {statusLabel}
                            </Badge>
                          </div>
                          {campaign.jobTitle && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                              <Badge variant="secondary">
                                {campaign.jobTitle}
                              </Badge>
                              <span>•</span>
                              <span>Created {campaign.createdAt.toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {campaign.status !== 'draft' && recipients > 0 && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {sent} of {recipients} sent
                            </span>
                            <span className="font-medium">{progressPercent}%</span>
                          </div>
                          <Progress value={progressPercent} />
                        </div>
                      )}

                      {/* Stats Row */}
                      <div className="flex gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {recipients} recipients
                          </span>
                        </div>
                        {sent > 0 && (
                          <>
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                {campaignOpenRate}% opened
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                {campaignReplyRate}% replied
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      {campaignsList.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Showing {campaignsList.length} campaigns
          {campaignsList.length === 100 && ' (limited to 100 most recent)'}
        </div>
      )}
    </div>
  )
}
