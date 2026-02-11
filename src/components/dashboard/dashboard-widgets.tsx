'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Calendar,
  Video,
  ExternalLink,
  Clock,
  Brain,
  UserPlus,
  Send,
  ArrowRightLeft,
  Briefcase,
  BarChart3,
  Loader2,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InterviewPipelineData {
  name: string
  count: number
  color: string
}

interface UpcomingInterview {
  id: string
  candidateName: string
  jobTitle: string
  scheduledAt: string
  location: string | null
}

interface RecentActivityItem {
  id: string
  type: string
  description: string
  timestamp: string
  link?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Widget Skeleton
// ---------------------------------------------------------------------------

function WidgetSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Interview Pipeline Chart
// ---------------------------------------------------------------------------

export function InterviewPipelineChart() {
  const [data, setData] = useState<InterviewPipelineData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/interviews/pipeline-stats')
        if (res.ok) {
          const json = await res.json()
          setData([
            { name: 'Scheduled', count: json.scheduled ?? 0, color: '#6366f1' },
            { name: 'Completed', count: json.completed ?? 0, color: '#10b981' },
            { name: 'Cancelled', count: json.cancelled ?? 0, color: '#ef4444' },
          ])
        } else {
          // Fallback: try the interviews endpoint
          const fallbackRes = await fetch('/api/interviews?limit=200')
          if (fallbackRes.ok) {
            const json = await fallbackRes.json()
            const interviews = json.interviews ?? json ?? []
            const scheduled = interviews.filter(
              (i: { status: string }) =>
                i.status === 'scheduled' || i.status === 'confirmed' || i.status === 'pending'
            ).length
            const completed = interviews.filter(
              (i: { status: string }) => i.status === 'completed'
            ).length
            const cancelled = interviews.filter(
              (i: { status: string }) => i.status === 'cancelled'
            ).length

            setData([
              { name: 'Scheduled', count: scheduled, color: '#6366f1' },
              { name: 'Completed', count: completed, color: '#10b981' },
              { name: 'Cancelled', count: cancelled, color: '#ef4444' },
            ])
          }
        }
      } catch {
        // Use empty data on error
        setData([
          { name: 'Scheduled', count: 0, color: '#6366f1' },
          { name: 'Completed', count: 0, color: '#10b981' },
          { name: 'Cancelled', count: 0, color: '#ef4444' },
        ])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <WidgetSkeleton height={250} />

  const total = data.reduce((sum, d) => sum + d.count, 0)

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">
          No interview data yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Schedule interviews to see pipeline analytics
        </p>
      </div>
    )
  }

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--popover)',
              color: 'var(--popover-foreground)',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={48}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Upcoming Interviews Widget
// ---------------------------------------------------------------------------

export function UpcomingInterviewsWidget() {
  const [interviews, setInterviews] = useState<UpcomingInterview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/interviews/upcoming?limit=5')
        if (res.ok) {
          const json = await res.json()
          setInterviews(json.interviews ?? json ?? [])
        } else {
          // Fallback
          const fallbackRes = await fetch('/api/interviews?limit=50')
          if (fallbackRes.ok) {
            const json = await fallbackRes.json()
            const all = json.interviews ?? json ?? []
            const now = new Date()
            const upcoming = all
              .filter(
                (i: { status: string; scheduledAt: string }) =>
                  (i.status === 'scheduled' || i.status === 'confirmed' || i.status === 'pending') &&
                  new Date(i.scheduledAt) > now
              )
              .sort(
                (a: { scheduledAt: string }, b: { scheduledAt: string }) =>
                  new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
              )
              .slice(0, 5)
              .map(
                (i: {
                  id: string
                  candidateFirstName?: string
                  candidateLastName?: string
                  candidateName?: string
                  jobTitle?: string
                  scheduledAt: string
                  location?: string
                }) => ({
                  id: i.id,
                  candidateName:
                    i.candidateName ||
                    `${i.candidateFirstName ?? ''} ${i.candidateLastName ?? ''}`.trim() ||
                    'Unknown',
                  jobTitle: i.jobTitle ?? 'N/A',
                  scheduledAt: i.scheduledAt,
                  location: i.location ?? null,
                })
              )
            setInterviews(upcoming)
          }
        }
      } catch {
        // Silent
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <WidgetSkeleton height={200} />

  if (interviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Calendar className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">
          No upcoming interviews
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Scheduled interviews will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {interviews.map((interview) => (
        <div
          key={interview.id}
          className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/30"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
            <Video className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium">{interview.candidateName}</p>
            <p className="truncate text-xs text-muted-foreground">{interview.jobTitle}</p>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDateTime(interview.scheduledAt)}
            </div>
          </div>
          {interview.location && (
            <Button variant="outline" size="sm" className="shrink-0" asChild>
              <a
                href={interview.location}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Join interview"
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                Join
              </a>
            </Button>
          )}
        </div>
      ))}
      <div className="pt-1">
        <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
          <Link href="/interviews">View All Interviews</Link>
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recent Activity Feed (Client-side version)
// ---------------------------------------------------------------------------

const activityIconMap: Record<string, typeof UserPlus> = {
  candidate_added: UserPlus,
  campaign_sent: Send,
  email_replied: ArrowRightLeft,
  status_changed: ArrowRightLeft,
  job_created: Briefcase,
  interview_scheduled: Calendar,
  ai_analysis: Brain,
}

const activityColorMap: Record<string, { bg: string; text: string }> = {
  candidate_added: { bg: 'bg-blue-100', text: 'text-blue-600' },
  campaign_sent: { bg: 'bg-purple-100', text: 'text-purple-600' },
  email_replied: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  status_changed: { bg: 'bg-amber-100', text: 'text-amber-600' },
  job_created: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
  interview_scheduled: { bg: 'bg-blue-100', text: 'text-blue-600' },
  ai_analysis: { bg: 'bg-purple-100', text: 'text-purple-600' },
}

export function RecentActivityFeed() {
  const [activities, setActivities] = useState<RecentActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/activities/recent?limit=10')
        if (res.ok) {
          const json = await res.json()
          setActivities(json.activities ?? json ?? [])
        }
      } catch {
        // Silent
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <WidgetSkeleton height={200} />

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Clock className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">
          No recent activity
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Activity will appear as you use VerticalHire
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {activities.map((activity, index) => {
        const Icon = activityIconMap[activity.type] ?? ArrowRightLeft
        const colors = activityColorMap[activity.type] ?? {
          bg: 'bg-gray-100',
          text: 'text-gray-600',
        }
        const isLast = index === activities.length - 1

        return (
          <div key={activity.id} className="relative flex gap-4 pb-5">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-[17px] top-10 h-[calc(100%-24px)] w-px bg-border" />
            )}

            {/* Icon */}
            <div
              className={cn(
                'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                colors.bg
              )}
            >
              <Icon className={cn('h-4 w-4', colors.text)} />
            </div>

            {/* Content */}
            <div className="flex-1 pt-0.5">
              {activity.link ? (
                <Link
                  href={activity.link}
                  className="text-sm text-foreground hover:underline"
                >
                  {activity.description}
                </Link>
              ) : (
                <p className="text-sm text-foreground">{activity.description}</p>
              )}
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

// ---------------------------------------------------------------------------
// AI Sentiment Summary Card (for dashboard stats)
// ---------------------------------------------------------------------------

export function AiSentimentCard() {
  const [score, setScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/interviews/avg-sentiment')
        if (res.ok) {
          const json = await res.json()
          setScore(json.avgSentiment ?? json.score ?? null)
        }
      } catch {
        // Silent
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              <div className="h-7 w-16 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Avg AI Sentiment
            </p>
            <p className="text-2xl font-bold">
              {score !== null ? `${Math.round(score)}%` : 'N/A'}
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50">
            <Brain className="h-5 w-5 text-purple-600" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Across all completed interviews</span>
        </div>
      </CardContent>
    </Card>
  )
}
