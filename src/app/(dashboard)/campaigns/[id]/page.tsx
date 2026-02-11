import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft,
  Mail,
  Send,
  Eye,
  MousePointer,
  MessageSquare,
  AlertCircle,
  Users,
  Calendar,
  Clock,
  Briefcase,
} from 'lucide-react'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  campaigns,
  campaignSends,
  candidates,
  jobs,
  companyUsers,
} from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { CampaignDetailClient } from '@/components/campaigns/campaign-detail-client'

export const metadata = {
  title: 'Campaign Details | VerticalHire',
  description: 'View campaign details, stats, and recipient status',
}

interface CampaignDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id: campaignId } = await params

  const [companyUser] = await db
    .select({ companyId: companyUsers.companyId })
    .from(companyUsers)
    .where(eq(companyUsers.userId, session.user.id))
    .limit(1)

  if (!companyUser) redirect('/settings/company')

  // Fetch campaign
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.id, campaignId),
        eq(campaigns.companyId, companyUser.companyId)
      )
    )
    .limit(1)

  if (!campaign) notFound()

  // Fetch the job
  let jobTitle = ''
  if (campaign.jobId) {
    const [job] = await db
      .select({ title: jobs.title })
      .from(jobs)
      .where(eq(jobs.id, campaign.jobId))
      .limit(1)
    jobTitle = job?.title ?? ''
  }

  // Fetch sends with candidate info
  const sends = await db
    .select({
      sendId: campaignSends.id,
      status: campaignSends.status,
      sentAt: campaignSends.sentAt,
      openedAt: campaignSends.openedAt,
      clickedAt: campaignSends.clickedAt,
      repliedAt: campaignSends.repliedAt,
      bouncedAt: campaignSends.bouncedAt,
      errorMessage: campaignSends.errorMessage,
      candidateId: candidates.id,
      candidateFirstName: candidates.firstName,
      candidateLastName: candidates.lastName,
      candidateEmail: candidates.email,
      candidateTitle: candidates.currentTitle,
    })
    .from(campaignSends)
    .innerJoin(candidates, eq(campaignSends.candidateId, candidates.id))
    .where(eq(campaignSends.campaignId, campaignId))
    .orderBy(desc(campaignSends.sentAt))

  // Compute live stats
  const liveStats = {
    totalRecipients: sends.length,
    totalSent: sends.filter((s) => s.sentAt !== null).length,
    totalOpened: sends.filter((s) => s.openedAt !== null).length,
    totalClicked: sends.filter((s) => s.clickedAt !== null).length,
    totalReplied: sends.filter((s) => s.repliedAt !== null).length,
    totalBounced: sends.filter((s) => s.bouncedAt !== null).length,
    totalPending: sends.filter((s) => s.status === 'pending' || s.status === 'queued').length,
  }

  // Serialize dates for client component
  const serializedSends = sends.map((s) => ({
    ...s,
    sentAt: s.sentAt?.toISOString() ?? null,
    openedAt: s.openedAt?.toISOString() ?? null,
    clickedAt: s.clickedAt?.toISOString() ?? null,
    repliedAt: s.repliedAt?.toISOString() ?? null,
    bouncedAt: s.bouncedAt?.toISOString() ?? null,
  }))

  const serializedCampaign = {
    id: campaign.id,
    name: campaign.name,
    subject: campaign.subject,
    body: campaign.body,
    status: campaign.status as string,
    campaignType: campaign.campaignType,
    scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
    sentAt: campaign.sentAt?.toISOString() ?? null,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
    totalRecipients: campaign.totalRecipients,
    totalSent: campaign.totalSent,
    totalOpened: campaign.totalOpened,
    totalClicked: campaign.totalClicked,
    totalReplied: campaign.totalReplied,
    totalBounced: campaign.totalBounced,
    jobId: campaign.jobId,
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Campaigns
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {jobTitle && (
              <span className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" />
                {jobTitle}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Created {formatDistanceToNow(new Date(campaign.createdAt), { addSuffix: true })}
            </span>
            {campaign.scheduledAt && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Scheduled for {format(new Date(campaign.scheduledAt), 'PPp')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Client component handles interactive parts */}
      <CampaignDetailClient
        campaign={serializedCampaign}
        sends={serializedSends}
        liveStats={liveStats}
      />
    </div>
  )
}
