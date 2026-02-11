'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { NotificationPanel } from '@/components/notifications/notification-panel'

const POLL_INTERVAL = 30_000 // 30 seconds

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/unread-count')
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.count ?? 0)
      }
    } catch {
      // Silently fail polling
    }
  }, [])

  useEffect(() => {
    fetchUnreadCount()
    intervalRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchUnreadCount])

  // Refresh count when panel closes
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      // Refresh count after a short delay to catch mark-as-read actions
      setTimeout(fetchUnreadCount, 500)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className={cn(
                'absolute flex items-center justify-center rounded-full bg-red-500 text-white font-medium',
                unreadCount > 9
                  ? 'right-0 top-0 h-5 min-w-5 px-1 text-[10px]'
                  : 'right-0.5 top-0.5 h-4 w-4 text-[10px]'
              )}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-96 p-0"
      >
        <NotificationPanel
          onClose={() => setOpen(false)}
          onCountChange={setUnreadCount}
        />
      </PopoverContent>
    </Popover>
  )
}
