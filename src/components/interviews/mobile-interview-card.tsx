'use client'

import {
  Calendar,
  Clock,
  Video,
  User,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

interface MobileInterviewCardProps {
  interview: {
    id: string
    scheduledAt: string
    durationMinutes: number
    status: string
    zoomJoinUrl: string | null
    candidateFirstName: string
    candidateLastName: string
    jobTitle: string | null
    aiSentimentScore: number | null
  }
}

const statusIcons: Record<string, typeof CheckCircle2> = {
  scheduled: Calendar,
  in_progress: Video,
  completed: CheckCircle2,
  canceled: XCircle,
  no_show: AlertCircle,
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-red-100 text-red-800',
  completed: 'bg-green-100 text-green-800',
  canceled: 'bg-gray-100 text-gray-800',
  no_show: 'bg-red-100 text-red-800',
}

export function MobileInterviewCard({ interview }: MobileInterviewCardProps) {
  const scheduled = new Date(interview.scheduledAt)
  const now = new Date()
  const isToday = scheduled.toDateString() === now.toDateString()
  const isSoon = scheduled.getTime() - now.getTime() < 60 * 60 * 1000 && scheduled > now
  const StatusIcon = statusIcons[interview.status] || Calendar

  return (
    <Link
      href={`/interviews/${interview.id}`}
      className="block touch-manipulation"
    >
      <div className={`bg-white dark:bg-gray-900 rounded-xl border p-4 active:bg-gray-50 transition ${
        isSoon ? 'border-orange-300 ring-1 ring-orange-200' : ''
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
              interview.status === 'in_progress'
                ? 'bg-red-100 animate-pulse'
                : 'bg-orange-100'
            }`}>
              <StatusIcon className={`h-5 w-5 ${
                interview.status === 'in_progress' ? 'text-red-600' : 'text-orange-600'
              }`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">
                {interview.candidateFirstName} {interview.candidateLastName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {interview.jobTitle || 'General Interview'}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {isToday ? 'Today' : scheduled.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {scheduled.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={`text-[10px] ${statusColors[interview.status] || statusColors.scheduled}`}>
              {interview.status.replace('_', ' ')}
            </Badge>
            {interview.aiSentimentScore != null && (
              <span className="text-[10px] text-muted-foreground font-medium">
                {interview.aiSentimentScore}/100
              </span>
            )}
            <ChevronRight className="h-4 w-4 text-gray-300" />
          </div>
        </div>

        {/* Join button for active/upcoming interviews */}
        {(interview.status === 'in_progress' || isSoon) && interview.zoomJoinUrl && (
          <div className="mt-3 pt-3 border-t">
            <a
              href={interview.zoomJoinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium active:bg-red-700 transition w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <Video className="h-4 w-4" />
              {interview.status === 'in_progress' ? 'Rejoin Call' : 'Join Call'}
            </a>
          </div>
        )}
      </div>
    </Link>
  )
}
