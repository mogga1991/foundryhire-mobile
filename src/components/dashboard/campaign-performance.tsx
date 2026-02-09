'use client'

import { BarChart3 } from 'lucide-react'

export interface CampaignPerformanceItem {
  id: string
  name: string
  responseRate: number
}

interface CampaignPerformanceProps {
  campaigns: CampaignPerformanceItem[]
}

export function CampaignPerformance({ campaigns }: CampaignPerformanceProps) {
  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">
          No campaigns yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Campaign performance will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {campaigns.map((campaign) => (
        <div key={campaign.id} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="truncate text-sm font-medium">{campaign.name}</p>
            <span className="shrink-0 text-sm text-muted-foreground">
              {campaign.responseRate}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-500"
              style={{ width: `${Math.min(campaign.responseRate, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
