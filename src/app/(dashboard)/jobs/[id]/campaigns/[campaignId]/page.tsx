'use client'

import { use } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CampaignStats } from '@/components/campaigns/campaign-stats'
import { useCampaign, useLaunchCampaign } from '@/hooks/use-campaigns'
import {
  ArrowLeft,
  Loader2,
  Play,
  Pause,
  Mail,
  Check,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, format } from 'date-fns'

interface CampaignDetailPageProps {
  params: Promise<{ id: string; campaignId: string }>
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
  active: {
    label: 'Active',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  paused: {
    label: 'Paused',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  completed: {
    label: 'Completed',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
}

const sendStatusConfig: Record<string, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
  sent: {
    label: 'Sent',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  delivered: {
    label: 'Delivered',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  bounced: {
    label: 'Bounced',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
}

function StatusBadge({ status, config }: { status: string; config: Record<string, { label: string; className: string }> }) {
  const c = config[status] ?? config.pending ?? { label: status, className: '' }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', c.className)}>
      {c.label}
    </span>
  )
}

function BoolIcon({ value }: { value: boolean }) {
  return value ? (
    <Check className="h-4 w-4 text-green-600" />
  ) : (
    <X className="h-4 w-4 text-muted-foreground/40" />
  )
}

export default function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { id: jobId, campaignId } = use(params)
  const { data: campaign, loading, error, refetch } = useCampaign(campaignId)
  const { launchCampaign, pauseCampaign, resumeCampaign, loading: actionLoading } = useLaunchCampaign()

  const handleLaunch = async () => {
    const success = await launchCampaign(campaignId)
    if (success) refetch()
  }

  const handlePause = async () => {
    const success = await pauseCampaign(campaignId)
    if (success) refetch()
  }

  const handleResume = async () => {
    const success = await resumeCampaign(campaignId)
    if (success) refetch()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="space-y-4">
        <Link href={`/jobs/${jobId}/campaigns`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back to Campaigns
          </Button>
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
          <p className="text-sm text-destructive">{error || 'Campaign not found'}</p>
        </div>
      </div>
    )
  }

  const sends = campaign.campaign_sends ?? []
  const totalSent = sends.filter((s) => s.sentAt !== null).length
  const totalOpened = sends.filter((s) => s.openedAt !== null).length
  const totalClicked = sends.filter((s) => s.clickedAt !== null).length
  const totalReplied = sends.filter((s) => s.repliedAt !== null).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/jobs/${jobId}/campaigns`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
            <StatusBadge status={campaign.status} config={statusConfig} />
          </div>
          <p className="text-sm text-muted-foreground">
            Created {formatDistanceToNow(new Date(campaign.createdAt), { addSuffix: true })}
            {campaign.sentAt && (
              <> &middot; Sent {format(new Date(campaign.sentAt), 'MMM d, yyyy h:mm a')}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === 'draft' && (
            <Button onClick={handleLaunch} disabled={actionLoading}>
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Launch Campaign
            </Button>
          )}
          {campaign.status === 'active' && (
            <Button variant="outline" onClick={handlePause} disabled={actionLoading}>
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
              Pause Campaign
            </Button>
          )}
          {campaign.status === 'paused' && (
            <Button onClick={handleResume} disabled={actionLoading}>
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Resume Campaign
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <CampaignStats
        totalSent={totalSent}
        totalOpened={totalOpened}
        totalClicked={totalClicked}
        totalReplied={totalReplied}
        totalRecipients={campaign.totalRecipients}
      />

      {/* Visual bar chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Engagement Rates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                label: 'Open Rate',
                value: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
                color: 'bg-green-500',
              },
              {
                label: 'Click Rate',
                value: totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0,
                color: 'bg-yellow-500',
              },
              {
                label: 'Reply Rate',
                value: totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0,
                color: 'bg-purple-500',
              },
            ].map((bar) => (
              <div key={bar.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{bar.label}</span>
                  <span className="text-muted-foreground">{bar.value}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', bar.color)}
                    style={{ width: `${bar.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Email Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Email Content
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <span className="text-sm font-medium text-muted-foreground">Subject: </span>
              <span className="text-sm">{campaign.subject}</span>
            </div>
            <Separator />
            <div className="whitespace-pre-wrap text-sm text-muted-foreground">
              {campaign.body}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sends Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign Sends ({sends.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {sends.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No sends recorded for this campaign yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="text-center">Opened</TableHead>
                  <TableHead className="text-center">Clicked</TableHead>
                  <TableHead className="text-center">Replied</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sends.map((send) => (
                  <TableRow key={send.id}>
                    <TableCell className="font-medium">
                      {send.candidates
                        ? `${send.candidates.firstName} ${send.candidates.lastName}`
                        : 'Unknown'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {send.candidates?.email ?? '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {send.sentAt
                        ? format(new Date(send.sentAt), 'MMM d, h:mm a')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <BoolIcon value={send.openedAt !== null} />
                    </TableCell>
                    <TableCell className="text-center">
                      <BoolIcon value={send.clickedAt !== null} />
                    </TableCell>
                    <TableCell className="text-center">
                      <BoolIcon value={send.repliedAt !== null} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={send.status} config={sendStatusConfig} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
