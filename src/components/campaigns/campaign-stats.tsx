'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Send, Eye, MousePointer, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CampaignStatsProps {
  totalSent: number
  totalOpened: number
  totalClicked: number
  totalReplied: number
  totalRecipients: number
}

interface StatCardProps {
  label: string
  count: number
  total: number
  icon: React.ReactNode
  color: string
  barColor: string
}

function StatCard({ label, count, total, icon, color, barColor }: StatCardProps) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-sm text-muted-foreground">{percentage}%</p>
            </div>
          </div>
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', color)}>
            {icon}
          </div>
        </div>
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all duration-500', barColor)}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function CampaignStats({
  totalSent,
  totalOpened,
  totalClicked,
  totalReplied,
  totalRecipients,
}: CampaignStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Sent"
        count={totalSent}
        total={totalRecipients}
        icon={<Send className="h-5 w-5 text-blue-600" />}
        color="bg-blue-100 dark:bg-blue-900/30"
        barColor="bg-blue-500"
      />
      <StatCard
        label="Opened"
        count={totalOpened}
        total={totalSent > 0 ? totalSent : totalRecipients}
        icon={<Eye className="h-5 w-5 text-green-600" />}
        color="bg-green-100 dark:bg-green-900/30"
        barColor="bg-green-500"
      />
      <StatCard
        label="Clicked"
        count={totalClicked}
        total={totalSent > 0 ? totalSent : totalRecipients}
        icon={<MousePointer className="h-5 w-5 text-yellow-600" />}
        color="bg-yellow-100 dark:bg-yellow-900/30"
        barColor="bg-yellow-500"
      />
      <StatCard
        label="Replied"
        count={totalReplied}
        total={totalSent > 0 ? totalSent : totalRecipients}
        icon={<MessageSquare className="h-5 w-5 text-purple-600" />}
        color="bg-purple-100 dark:bg-purple-900/30"
        barColor="bg-purple-500"
      />
    </div>
  )
}
