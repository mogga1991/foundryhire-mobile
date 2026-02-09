'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  MessageSquare,
  Mail,
  Phone,
  ArrowUpDown,
  Loader2,
  Plus,
  FileText,
  Star,
  Clock,
} from 'lucide-react'
import type { CandidateActivity } from '@/lib/types'

// ============================================================================
// Types
// ============================================================================

interface ActivityFeedProps {
  candidateId: string
  companyId: string
}

// ============================================================================
// Helper Functions
// ============================================================================

function getActivityIcon(activityType: string) {
  switch (activityType) {
    case 'note':
      return <MessageSquare className="size-4" />
    case 'email':
      return <Mail className="size-4" />
    case 'call':
      return <Phone className="size-4" />
    case 'status_change':
      return <ArrowUpDown className="size-4" />
    case 'resume_uploaded':
      return <FileText className="size-4" />
    case 'scored':
      return <Star className="size-4" />
    default:
      return <Clock className="size-4" />
  }
}

function getActivityIconBg(activityType: string): string {
  switch (activityType) {
    case 'note':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'email':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    case 'call':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'status_change':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    case 'resume_uploaded':
      return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
    case 'scored':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function formatTimestamp(dateString: string | Date): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

// ============================================================================
// ActivityFeed Component
// ============================================================================

export function ActivityFeed({ candidateId, companyId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<CandidateActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [noteText, setNoteText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch(`/api/candidates/${candidateId}/activities`)
      if (!res.ok) throw new Error('Failed to fetch activities')
      const result = await res.json()
      setActivities(result.activities || [])
    } catch {
      // Silently handle error - activities are supplementary
      setActivities([])
    } finally {
      setLoading(false)
    }
  }, [candidateId])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  const handleAddNote = async () => {
    if (!noteText.trim()) return

    setSubmitting(true)

    try {
      const res = await fetch(`/api/candidates/${candidateId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          activityType: 'note',
          title: 'Note added',
          description: noteText.trim(),
        }),
      })

      if (!res.ok) throw new Error('Failed to add note')

      setNoteText('')
      await fetchActivities()
    } catch {
      // Silently handle error
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="size-4" />
          Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Note Form */}
        <div className="space-y-2">
          <Textarea
            placeholder="Add a note about this candidate..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={submitting || !noteText.trim()}
            >
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              Add Note
            </Button>
          </div>
        </div>

        <Separator />

        {/* Activity Timeline */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No activity yet. Add a note to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex gap-3">
                {/* Icon */}
                <div
                  className={`size-8 rounded-full flex items-center justify-center shrink-0 ${getActivityIconBg(
                    activity.activityType
                  )}`}
                >
                  {getActivityIcon(activity.activityType)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {formatTimestamp(activity.createdAt)}
                    </span>
                  </div>
                  {activity.description && (
                    <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                      {activity.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
