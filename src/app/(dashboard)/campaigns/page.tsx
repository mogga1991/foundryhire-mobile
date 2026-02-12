import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { campaigns, jobs, companyUsers } from '@/lib/db/schema'
import { eq, desc, count, sum } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CampaignsList } from '@/components/campaigns/campaigns-list'

export const metadata = {
  title: 'Campaigns | VerticalHire',
  description: 'View and manage all your email campaigns',
}

export default async function CampaignsPage() {
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
    <CampaignsList
      campaigns={campaignsList}
      stats={{
        totalCampaigns: Number(stats.totalCampaigns),
        totalSent,
        totalOpened,
        totalReplied,
        openRate,
        replyRate,
      }}
      firstJobId={firstJob?.id ?? null}
    />
  )
}
