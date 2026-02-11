import { Skeleton } from '@/components/ui/skeleton'
import {
  PageHeaderSkeleton,
  JobCardsSkeleton,
} from '@/components/skeletons/page-skeletons'

export default function JobsLoading() {
  return (
    <div className="space-y-8">
      {/* Page header with title and create button */}
      <PageHeaderSkeleton />

      {/* Job list cards */}
      <JobCardsSkeleton count={6} />
    </div>
  )
}
