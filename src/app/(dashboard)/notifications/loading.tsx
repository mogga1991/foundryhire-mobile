import { Skeleton } from '@/components/ui/skeleton'
import { NotificationListSkeleton } from '@/components/skeletons/page-skeletons'

export default function NotificationsLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-md" />
        ))}
      </div>

      {/* Notification list */}
      <NotificationListSkeleton count={10} />
    </div>
  )
}
