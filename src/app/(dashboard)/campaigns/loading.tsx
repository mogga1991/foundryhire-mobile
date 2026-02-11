import { Skeleton } from '@/components/ui/skeleton'
import {
  StatCardsSkeleton,
  PageHeaderSkeleton,
  CampaignCardsSkeleton,
} from '@/components/skeletons/page-skeletons'

export default function CampaignsLoading() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <PageHeaderSkeleton />

      {/* Stats cards */}
      <StatCardsSkeleton count={4} />

      {/* Campaign list cards */}
      <CampaignCardsSkeleton count={5} />

      {/* Footer text */}
      <div className="flex justify-center">
        <Skeleton className="h-4 w-36" />
      </div>
    </div>
  )
}
