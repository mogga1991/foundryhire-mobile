'use client'

import { useState, useMemo } from 'react'
import { Briefcase, Filter, Search } from 'lucide-react'
import { JobCard } from '@/components/jobs/job-card'
import { CreateJobDialog } from '@/components/jobs/create-job-dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Job } from '@/lib/types'

interface JobListProps {
  jobs: Job[]
  candidateCounts?: Record<string, number>
}

type SortOption = 'date_desc' | 'date_asc' | 'title_asc' | 'title_desc' | 'candidates_desc'

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'date_desc', label: 'Newest First' },
  { value: 'date_asc', label: 'Oldest First' },
  { value: 'title_asc', label: 'Title A-Z' },
  { value: 'title_desc', label: 'Title Z-A' },
  { value: 'candidates_desc', label: 'Most Candidates' },
]

function sortJobs(
  jobs: Job[],
  sortBy: SortOption,
  candidateCounts: Record<string, number>
): Job[] {
  const sorted = [...jobs]
  switch (sortBy) {
    case 'date_desc':
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    case 'date_asc':
      return sorted.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    case 'title_asc':
      return sorted.sort((a, b) => a.title.localeCompare(b.title))
    case 'title_desc':
      return sorted.sort((a, b) => b.title.localeCompare(a.title))
    case 'candidates_desc':
      return sorted.sort(
        (a, b) => (candidateCounts[b.id] ?? 0) - (candidateCounts[a.id] ?? 0)
      )
    default:
      return sorted
  }
}

function EmptyState({ status }: { status: string }) {
  const message =
    status === 'all'
      ? 'Create your first job to start finding candidates'
      : `No ${status} jobs found.`

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 px-4 text-center">
      <div className="rounded-full bg-primary/10 p-4 mb-4">
        <Briefcase className="size-12 text-primary" />
      </div>
      <h3 className="text-xl font-semibold mb-2">
        {status === 'all' ? 'No jobs yet' : 'No Jobs Found'}
      </h3>
      <p className="text-muted-foreground text-sm mb-6 max-w-sm">{message}</p>
      <CreateJobDialog />
    </div>
  )
}

export function JobList({ jobs, candidateCounts = {} }: JobListProps) {
  const [sortBy, setSortBy] = useState<SortOption>('date_desc')
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredJobs = useMemo(() => {
    let filtered = activeTab === 'all'
      ? jobs
      : jobs.filter((job) => job.status === activeTab)

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((job) =>
        job.title.toLowerCase().includes(query) ||
        job.location?.toLowerCase().includes(query) ||
        job.department?.toLowerCase().includes(query)
      )
    }

    return sortJobs(filtered, sortBy, candidateCounts)
  }, [jobs, activeTab, sortBy, candidateCounts, searchQuery])

  const counts = useMemo(() => {
    return {
      all: jobs.length,
      active: jobs.filter((j) => j.status === 'active').length,
      draft: jobs.filter((j) => j.status === 'draft').length,
      closed: jobs.filter((j) => j.status === 'closed').length,
    }
  }, [jobs])

  const showFilters = jobs.length > 0

  return (
    <div className="space-y-6">
      {showFilters && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col gap-4">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
              <TabsTrigger value="active">Active ({counts.active})</TabsTrigger>
              <TabsTrigger value="draft">Draft ({counts.draft})</TabsTrigger>
              <TabsTrigger value="closed">Closed ({counts.closed})</TabsTrigger>
            </TabsList>

            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search jobs by title, location, or department..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-muted-foreground" />
                <Select
                  value={sortBy}
                  onValueChange={(value) => setSortBy(value as SortOption)}
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-6">
            {filteredJobs.length === 0 ? (
              <EmptyState status={searchQuery ? 'search' : activeTab} />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    candidateCount={candidateCounts[job.id] ?? 0}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {!showFilters && <EmptyState status="all" />}
    </div>
  )
}
