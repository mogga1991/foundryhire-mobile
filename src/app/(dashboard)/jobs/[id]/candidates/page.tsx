'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CandidateList } from '@/components/candidates/candidate-list'
import {
  useCandidates,
  type CandidateSortField,
  type CandidateStatusFilter,
} from '@/hooks/use-candidates'
import type { Job } from '@/lib/types'
import {
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Loader2,
  Users,
  Target,
} from 'lucide-react'

// ============================================================================
// CandidatesPage
// ============================================================================

export default function CandidatesPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string

  // Local state for filters
  const [job, setJob] = useState<Job | null>(null)
  const [jobLoading, setJobLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortField, setSortField] = useState<CandidateSortField>('ai_score')
  const [statusFilter, setStatusFilter] = useState<CandidateStatusFilter>('all')
  const [page, setPage] = useState(1)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1) // Reset to page 1 on new search
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch job details
  useEffect(() => {
    async function fetchJob() {
      try {
        const res = await fetch(`/api/jobs?id=${jobId}`)
        if (!res.ok) throw new Error('Failed to fetch job')
        const result = await res.json()
        setJob(result.data)
      } catch {
        // Handle error silently
      } finally {
        setJobLoading(false)
      }
    }

    fetchJob()
  }, [jobId])

  // Fetch candidates using custom hook
  const {
    candidates,
    loading: candidatesLoading,
    total,
    totalPages,
    page: currentPage,
  } = useCandidates({
    jobId,
    sortField,
    sortOrder: sortField === 'ai_score' ? 'desc' : 'asc',
    statusFilter,
    searchQuery: debouncedSearch,
    page,
  })

  const handleSortChange = (value: string) => {
    setSortField(value as CandidateSortField)
    setPage(1)
  }

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as CandidateStatusFilter)
    setPage(1)
  }

  if (jobLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Candidates
          </h1>
          {job && (
            <p className="text-muted-foreground mt-1">
              for {job.title}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/jobs/${jobId}/source`)}
          >
            <Target className="size-4" />
            Source Candidates
          </Button>
          <Button onClick={() => router.push(`/jobs/${jobId}/source`)}>
            <Plus className="size-4" />
            Add Candidate
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[160px]">
            <Filter className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="responded">Responded</SelectItem>
            <SelectItem value="interviewing">Interviewing</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortField} onValueChange={handleSortChange}>
          <SelectTrigger className="w-[180px]">
            <ArrowUpDown className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ai_score">AI Match Score</SelectItem>
            <SelectItem value="first_name">Name</SelectItem>
            <SelectItem value="created_at">Date Added</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Candidates List or Empty State */}
      {!candidatesLoading && candidates.length === 0 && !debouncedSearch && statusFilter === 'all' ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Users className="size-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">No candidates yet</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Start building your talent pipeline by sourcing candidates from LinkedIn, uploading a CSV, or adding them manually.
          </p>
          <Button onClick={() => router.push(`/jobs/${jobId}/source`)}>
            <Target className="size-4" />
            Source Candidates
          </Button>
        </div>
      ) : (
        <CandidateList
          candidates={candidates}
          jobId={jobId}
          total={total}
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          loading={candidatesLoading}
        />
      )}
    </div>
  )
}
