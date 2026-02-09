'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Send, Eye, MessageSquare, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Campaign } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'

interface CampaignListProps {
  campaigns: Campaign[]
  jobId: string
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

function getStatusBadge(status: string) {
  const config = statusConfig[status] ?? statusConfig.draft
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  )
}

export function CampaignList({ campaigns, jobId }: CampaignListProps) {
  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
            <Mail className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No campaigns yet</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Create your first outreach campaign to start engaging with candidates for this job.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4">
      {campaigns.map((campaign) => {
        const openRate = campaign.totalSent > 0
          ? Math.round((campaign.totalOpened / campaign.totalSent) * 100)
          : 0
        const replyRate = campaign.totalSent > 0
          ? Math.round((campaign.totalReplied / campaign.totalSent) * 100)
          : 0

        return (
          <Link
            key={campaign.id}
            href={`/jobs/${jobId}/campaigns/${campaign.id}`}
            className="block"
          >
            <Card className="transition-colors hover:bg-accent/50">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{campaign.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDistanceToNow(new Date(campaign.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {getStatusBadge(campaign.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Send className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                    <span>{campaign.totalSent} sent</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Eye className="h-3.5 w-3.5 shrink-0 text-green-500" />
                    <span>{campaign.totalOpened} opened ({openRate}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-purple-500" />
                    <span>{campaign.totalReplied} replied ({replyRate}%)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
