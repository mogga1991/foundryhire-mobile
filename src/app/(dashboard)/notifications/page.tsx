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
  CheckCheck,
  Loader2,
  Inbox,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { NotificationType, Notification } from '@/components/notifications/notification-panel'

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

const typeLabels: Record<NotificationType, string> = {
  interview: 'Interviews',
  candidate: 'Candidates',
  ai: 'AI Insights',
  team: 'Team',
  system: 'System',
}

type FilterType = 'all' | 'unread' | NotificationType

const filterOptions: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'interview', label: 'Interviews' },
  { value: 'candidate', label: 'Candidates' },
  { value: 'ai', label: 'AI Insights' },
  { value: 'team', label: 'Team' },
  { value: 'system', label: 'System' },
]

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
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function NotificationSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4">
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)

  const pageSize = 20

  const fetchNotifications = useCallback(
    async (pageNum: number, append: boolean = false) => {
      try {
        if (pageNum === 1) setLoading(true)
        else setLoadingMore(true)

        const params = new URLSearchParams({
          limit: String(pageSize),
          offset: String((pageNum - 1) * pageSize),
        })

        const res = await fetch(`/api/notifications?${params}`)
        if (res.ok) {
          const data = await res.json()
          const items: Notification[] = data.notifications ?? data ?? []
          if (append) {
            setNotifications((prev) => [...prev, ...items])
          } else {
            setNotifications(items)
          }
          setHasMore(items.length >= pageSize)
        }
      } catch {
        toast.error('Failed to load notifications')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchNotifications(1)
  }, [fetchNotifications])

  // Click handler
  async function handleClick(notification: Notification) {
    if (!notification.read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      )
      try {
        await fetch(`/api/notifications/${notification.id}/read`, { method: 'PATCH' })
      } catch {
        // Silent
      }
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl)
    }
  }

  // Mark single as read
  async function handleMarkRead(e: React.MouseEvent, notification: Notification) {
    e.stopPropagation()
    if (notification.read) return

    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    )
    try {
      await fetch(`/api/notifications/${notification.id}/read`, { method: 'PATCH' })
    } catch {
      // Silent
    }
  }

  // Mark all as read
  async function handleMarkAllRead() {
    setMarkingAll(true)
    try {
      const res = await fetch('/api/notifications/mark-all-read', { method: 'POST' })
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        toast.success('All notifications marked as read')
      }
    } catch {
      toast.error('Failed to mark all as read')
    } finally {
      setMarkingAll(false)
    }
  }

  // Load more
  function handleLoadMore() {
    const nextPage = page + 1
    setPage(nextPage)
    fetchNotifications(nextPage, true)
  }

  // Filter notifications
  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'all') return true
    if (filter === 'unread') return !n.read
    return n.type === filter
  })

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markingAll}
          >
            {markingAll ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="mr-2 h-4 w-4" />
            )}
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((opt) => (
          <Button
            key={opt.value}
            variant={filter === opt.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(opt.value)}
            className="h-8"
          >
            {opt.label}
            {opt.value === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                {unreadCount}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Notification List */}
      <Card>
        <CardContent className="p-0">
          {loading && <NotificationSkeleton />}

          {!loading && filteredNotifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                {filter === 'all'
                  ? "You're all caught up!"
                  : filter === 'unread'
                    ? 'No unread notifications'
                    : `No ${typeLabels[filter as NotificationType] ?? ''} notifications`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                {filter !== 'all'
                  ? 'Try switching to a different filter'
                  : 'Check back later for new updates'}
              </p>
            </div>
          )}

          {!loading &&
            filteredNotifications.map((notification, index) => {
              const Icon = typeIconMap[notification.type]
              const colors = typeColorMap[notification.type]
              const isLast = index === filteredNotifications.length - 1

              return (
                <div key={notification.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(notification)}
                    className={cn(
                      'flex w-full gap-4 px-6 py-4 text-left transition-colors hover:bg-accent/50',
                      !notification.read && 'bg-accent/20'
                    )}
                    aria-label={`${notification.read ? '' : 'Unread: '}${notification.title}`}
                  >
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                        colors.bg
                      )}
                    >
                      <Icon className={cn('h-5 w-5', colors.text)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p
                            className={cn(
                              'text-sm',
                              !notification.read ? 'font-semibold' : 'font-medium'
                            )}
                          >
                            {notification.title}
                          </p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {notification.message}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground/60">
                            {formatTimeAgo(notification.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!notification.read && (
                            <>
                              <span className="h-2 w-2 rounded-full bg-blue-500" />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => handleMarkRead(e, notification)}
                                aria-label="Mark as read"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                  {!isLast && <Separator />}
                </div>
              )
            })}

          {/* Load more */}
          {!loading && hasMore && filteredNotifications.length > 0 && filter === 'all' && (
            <div className="flex justify-center py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Load More
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
