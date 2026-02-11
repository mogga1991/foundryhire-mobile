'use client'

import { NotificationBell } from '@/components/notifications/notification-bell'

export function DashboardHeader() {
  return (
    <div className="hidden lg:flex h-14 items-center justify-end gap-2 border-b border-slate-200 bg-white/80 px-6 backdrop-blur-sm">
      <NotificationBell />
    </div>
  )
}
