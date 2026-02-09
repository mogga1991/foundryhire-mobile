'use client'

import { TrendingUp, TrendingDown, Briefcase, Users, MailOpen, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface StatItem {
  title: string
  value: string | number
  change: string
  trend: 'up' | 'down' | 'neutral'
  iconName: 'briefcase' | 'users' | 'mail' | 'calendar'
}

interface StatsGridProps {
  stats: StatItem[]
}

const iconMap = {
  briefcase: Briefcase,
  users: Users,
  mail: MailOpen,
  calendar: Calendar,
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = iconMap[stat.iconName]
        return (
          <Card key={stat.title}>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                  <Icon className="h-5 w-5 text-indigo-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs">
                {stat.trend === 'up' ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                ) : stat.trend === 'down' ? (
                  <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                ) : null}
                <span
                  className={cn(
                    'font-medium',
                    stat.trend === 'up'
                      ? 'text-emerald-600'
                      : stat.trend === 'down'
                        ? 'text-red-600'
                        : 'text-muted-foreground'
                  )}
                >
                  {stat.change}
                </span>
                <span className="text-muted-foreground">vs last month</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
