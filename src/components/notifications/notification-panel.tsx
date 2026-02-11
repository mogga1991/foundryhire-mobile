'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Calendar,
  User,
  Brain,
  Mail,
  Bell,
  Check,
  CheckCheck,
  Loader2,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType = 'interview' | 'candidate' | 'ai' | 'team' | 'system'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  actionUrl: string | null
  read: boolean
  createdAt: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const typeIconMap: Record<NotificationType, typeof Calendar> = {
  interview: Calendar,
  candidate: User,
  ai: Brain,
  team: Mail,
  system: Bell,
}

const typeColorMap: Record<NotificationType, { bg: string; text: string }> = {
  interview: { bg: 'bg-blue-100', text: 'text-blue-600' },
  candidate: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  ai: { bg: 'bg-purple-100', text: 'text-purple-600' },
  team: { bg: 'bg-amber-100', text: 'text-amber-600' },
  system: { bg: 'bg-gray-100', text: 'text-gray-600' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(dateString: string): string {
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

// ---------------------------------------------------------------------------
// Panel Component
// ---------------------------------------------------------------------------

interface NotificationPanelProps {
  onClose: () => void
  onCountChange: (count: number) => void
}

export function NotificationPanel({ onClose, onCountChange }: NotificationPanelProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=10')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications ?? data ?? [])
      }
    } catch {
      // Silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Mark single as read and navigate
  async function handleClick(notification: Notification) {
    if (!notification.read) {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      )
      onCountChange(Math.max(0, notifications.filter((n) => !n.read).length - 1))

      try {
        await fetch(`/api/notifications/${notification.id}/read`, { method: 'PATCH' })
      } catch {
        // Silent
      }
    }

    if (notification.actionUrl) {
      onClose()
      router.push(notification.actionUrl)
    }
  }

  // Mark all as read
  async function handleMarkAllRead() {
    setMarkingAll(true)
    try {
      const res = await fetch('/api/notifications/mark-all-read', { method: 'POST' })
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        onCountChange(0)
        toast.success('All notifications marked as read')
      }
    } catch {
      toast.error('Failed to mark notifications as read')
    } finally {
      setMarkingAll(false)
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold">Notifications</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs"
            onClick={handleMarkAllRead}
            disabled={markingAll}
          >
            {markingAll ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <CheckCheck className="mr-1 h-3 w-3" />
            )}
            Mark All as Read
          </Button>
        )}
      </div>

      <Separator />

      {/* List */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading && (
          <div className="space-y-1 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 rounded-lg p-3">
                <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-16 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Inbox className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              You&apos;re all caught up!
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              No new notifications
            </p>
          </div>
        )}

        {!loading &&
          notifications.map((notification) => {
            const Icon = typeIconMap[notification.type]
            const colors = typeColorMap[notification.type]

            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleClick(notification)}
                className={cn(
                  'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50',
                  !notification.read && 'bg-accent/30'
                )}
                aria-label={`${notification.read ? '' : 'Unread: '}${notification.title}`}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    colors.bg
                  )}
                >
                  <Icon className={cn('h-4 w-4', colors.text)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={cn(
                        'truncate text-sm',
                        !notification.read ? 'font-semibold' : 'font-medium'
                      )}
                    >
                      {notification.title}
                    </p>
                    {!notification.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {notification.message}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/60">
                    {formatTimeAgo(notification.createdAt)}
                  </p>
                </div>
              </button>
            )
          })}
      </div>

      <Separator />

      {/* Footer */}
      <div className="px-4 py-2">
        <Button
          variant="ghost"
          className="w-full justify-center text-xs"
          size="sm"
          onClick={() => {
            onClose()
            router.push('/notifications')
          }}
        >
          View All Notifications
        </Button>
      </div>
    </div>
  )
}
