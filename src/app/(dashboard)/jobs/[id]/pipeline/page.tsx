'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  ArrowLeft,
  Users,
  Loader2,
  AlertCircle,
  Filter,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  KanbanBoard,
  PIPELINE_STATUSES,
} from '@/components/pipeline/kanban-board'
import type { Candidate, Job } from '@/lib/types'

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All Sources' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'manual', label: 'Manual' },
]

export default function PipelinePage() {
  const params = useParams()
  const jobId = params.id as string

  // State
  const [job, setJob] = useState<Job | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')

  // Fetch job and candidates
  const fetchData = useCallback(async () => {
    if (!jobId) return

    setLoading(true)
    setError(null)

    try {
      // Fetch job details
      const jobRes = await fetch(`/api/jobs?id=${jobId}`)
      if (!jobRes.ok) {
        const errData = await jobRes.json()
        throw new Error(errData.error || 'Failed to fetch job')
      }
      const jobResult = await jobRes.json()
      setJob(jobResult.job)

      // Fetch all candidates for this job
      const candidateRes = await fetch(
        `/api/candidates?jobId=${jobId}&sortField=ai_score&sortOrder=desc&perPage=1000`
      )
      if (!candidateRes.ok) {
        const errData = await candidateRes.json()
        throw new Error(errData.error || 'Failed to fetch candidates')
      }
      const candidateResult = await candidateRes.json()
      setCandidates(candidateResult.candidates ?? [])
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load pipeline data'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle candidate status change via drag-and-drop
  const handleStatusChange = useCallback(
    async (candidateId: string, newStatus: string) => {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          updatedAt: new Date().toISOString(),
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to update candidate status')
      }

      // Update local state to reflect the change
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId
            ? { ...c, status: newStatus, updatedAt: new Date() }
            : c
        )
      )
    },
    []
  )

  // Filter candidates based on search query and source filter
  const filteredCandidates = useMemo(() => {
    let filtered = candidates

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (c) =>
          c.firstName.toLowerCase().includes(query) ||
          c.lastName.toLowerCase().includes(query) ||
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(query) ||
          (c.currentTitle?.toLowerCase().includes(query) ?? false) ||
          (c.currentCompany?.toLowerCase().includes(query) ?? false)
      )
    }

    // Apply source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(
        (c) => c.source?.toLowerCase() === sourceFilter.toLowerCase()
      )
    }

    return filtered
  }, [candidates, searchQuery, sourceFilter])

  // Stats: count per column
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const status of PIPELINE_STATUSES) {
      counts[status.id] = 0
    }
    for (const candidate of filteredCandidates) {
      const statusKey = candidate.status?.toLowerCase() ?? 'new'
      if (counts[statusKey] !== undefined) {
        counts[statusKey]++
      } else {
        counts['new']++
      }
    }
    return counts
  }, [filteredCandidates])

  const totalCandidates = filteredCandidates.length

  // Loading state
  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Loading pipeline...
          </p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="size-6 text-red-500" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              Failed to load pipeline
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" onClick={fetchData}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-0 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/jobs/${jobId}`}>
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Candidate Pipeline
            </h1>
            {job && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {job.title}
                {job.department ? ` - ${job.department}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
            <Users className="size-3.5" />
            <span className="text-sm font-medium">
              {totalCandidates} candidate{totalCandidates !== 1 ? 's' : ''}
            </span>
          </Badge>
        </div>
      </div>

      {/* Stats summary */}
      <div className="flex flex-wrap gap-2">
        {PIPELINE_STATUSES.map((status) => {
          const count = statusCounts[status.id] ?? 0
          return (
            <div
              key={status.id}
              className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5"
            >
              <StatusDot color={status.color} />
              <span className="text-xs font-medium text-muted-foreground">
                {status.label}
              </span>
              <span className="text-xs font-bold text-foreground">
                {count}
              </span>
            </div>
          )
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search candidates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-start gap-2">
          <Filter className="size-4 text-muted-foreground mt-1.5 shrink-0" />
          <div className="flex flex-wrap gap-1.5">
            {SOURCE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={sourceFilter === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSourceFilter(option.value)}
                className="h-8 px-2.5 text-xs"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <KanbanBoard
        candidates={filteredCandidates}
        jobId={jobId}
        onStatusChange={handleStatusChange}
      />
    </div>
  )
}

// Small colored dot for the stats summary
function StatusDot({ color }: { color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    emerald: 'bg-emerald-500',
    red: 'bg-red-500',
  }

  return (
    <span
      className={`inline-block size-2 rounded-full ${colorMap[color] ?? 'bg-gray-400'}`}
    />
  )
}
