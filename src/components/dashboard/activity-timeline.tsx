'use client'

import {
  UserPlus,
  Send,
  MessageSquare,
  ArrowRightLeft,
  Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type ActivityType =
  | 'candidate_added'
  | 'campaign_sent'
  | 'email_replied'
  | 'status_changed'
  | 'job_created'

export interface ActivityItem {
  id: string
  type: ActivityType
  description: string
  timestamp: string
}

interface ActivityTimelineProps {
  activities: ActivityItem[]
}

const activityConfig: Record<
  ActivityType,
  { icon: typeof UserPlus; bgColor: string; iconColor: string }
> = {
  candidate_added: {
    icon: UserPlus,
    bgColor: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  campaign_sent: {
    icon: Send,
    bgColor: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
  email_replied: {
    icon: MessageSquare,
    bgColor: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  status_changed: {
    icon: ArrowRightLeft,
    bgColor: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  job_created: {
    icon: Briefcase,
    bgColor: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
  },
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)

  if (diffSeconds < 60) {
    return 'Just now'
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  }
  if (diffWeeks < 4) {
    return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">
          No recent activity
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Activity will appear here as you use VerticalHire
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {activities.map((activity, index) => {
        const config = activityConfig[activity.type]
        const Icon = config.icon
        const isLast = index === activities.length - 1

        return (
          <div key={activity.id} className="relative flex gap-4 pb-6">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-[17px] top-10 h-[calc(100%-24px)] w-px bg-border" />
            )}

            {/* Icon */}
            <div
              className={cn(
                'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                config.bgColor
              )}
            >
              <Icon className={cn('h-4 w-4', config.iconColor)} />
            </div>

            {/* Content */}
            <div className="flex-1 pt-0.5">
              <p className="text-sm text-foreground">{activity.description}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatRelativeTime(activity.timestamp)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
