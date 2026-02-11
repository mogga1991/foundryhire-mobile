'use client'

import { useState, useEffect } from 'react'
import { Search, X, Filter, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface InterviewFiltersProps {
  onFilterChange: (filters: InterviewFilterState) => void
  initialFilters?: InterviewFilterState
}

export interface InterviewFilterState {
  status: string[]
  startDate?: string
  endDate?: string
  search?: string
  jobId?: string
  page?: number
  limit?: number
}

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled', color: 'bg-blue-100 text-blue-800' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-orange-100 text-orange-800' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
]

export function InterviewFilters({ onFilterChange, initialFilters }: InterviewFiltersProps) {
  const [filters, setFilters] = useState<InterviewFilterState>(
    initialFilters || {
      status: [],
      page: 1,
      limit: 20,
    }
  )
  const [jobs, setJobs] = useState<Array<{ id: string; title: string }>>([])
  const [isLoadingJobs, setIsLoadingJobs] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Fetch available jobs for filtering
  useEffect(() => {
    async function fetchJobs() {
      setIsLoadingJobs(true)
      try {
        const res = await fetch('/api/jobs')
        if (res.ok) {
          const data = await res.json()
          setJobs(data.jobs || [])
        }
      } catch (err) {
        console.error('Failed to fetch jobs:', err)
      } finally {
        setIsLoadingJobs(false)
      }
    }
    fetchJobs()
  }, [])

  // Notify parent of filter changes
  useEffect(() => {
    onFilterChange(filters)
  }, [filters, onFilterChange])

  const toggleStatus = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter((s) => s !== status)
        : [...prev.status, status],
      page: 1, // Reset to first page when filters change
    }))
  }

  const updateFilter = (key: keyof InterviewFilterState, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to first page when filters change
    }))
  }

  const clearFilters = () => {
    setFilters({
      status: [],
      page: 1,
      limit: 20,
    })
  }

  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.search ||
    filters.startDate ||
    filters.endDate ||
    filters.jobId

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      {/* Search and Status Filter Row */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by candidate name..."
            value={filters.search || ''}
            onChange={(e) => updateFilter('search', e.target.value || undefined)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
          />
          {filters.search && (
            <button
              onClick={() => updateFilter('search', undefined)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Toggle Advanced Filters */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            'gap-2',
            showAdvanced && 'bg-orange-50 border-orange-300'
          )}
        >
          <Filter className="h-4 w-4" />
          {showAdvanced ? 'Hide Filters' : 'Show Filters'}
        </Button>

        {/* Clear All */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-2 text-gray-600 hover:text-gray-900"
          >
            <X className="h-4 w-4" />
            Clear All
          </Button>
        )}
      </div>

      {/* Status Filter Chips */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm font-medium text-gray-700 py-1">Status:</span>
        {STATUS_OPTIONS.map(({ value, label, color }) => (
          <button
            key={value}
            onClick={() => toggleStatus(value)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition border',
              filters.status.includes(value)
                ? `${color} border-current`
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="pt-4 border-t border-gray-200 grid gap-4 md:grid-cols-3">
          {/* Date Range */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Start Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => updateFilter('startDate', e.target.value || undefined)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              End Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => updateFilter('endDate', e.target.value || undefined)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
              />
            </div>
          </div>

          {/* Job Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Job Position
            </label>
            <select
              value={filters.jobId || ''}
              onChange={(e) => updateFilter('jobId', e.target.value || undefined)}
              disabled={isLoadingJobs}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="">All Jobs</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-600 py-1">Active filters:</span>
          {filters.status.map((status) => {
            const option = STATUS_OPTIONS.find((opt) => opt.value === status)
            return (
              <Badge
                key={status}
                className={cn('gap-1', option?.color)}
              >
                {option?.label}
                <button
                  onClick={() => toggleStatus(status)}
                  className="hover:bg-black/10 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          })}
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Search: {filters.search}
              <button
                onClick={() => updateFilter('search', undefined)}
                className="hover:bg-black/10 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.startDate && (
            <Badge variant="secondary" className="gap-1">
              From: {new Date(filters.startDate).toLocaleDateString()}
              <button
                onClick={() => updateFilter('startDate', undefined)}
                className="hover:bg-black/10 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.endDate && (
            <Badge variant="secondary" className="gap-1">
              To: {new Date(filters.endDate).toLocaleDateString()}
              <button
                onClick={() => updateFilter('endDate', undefined)}
                className="hover:bg-black/10 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.jobId && (
            <Badge variant="secondary" className="gap-1">
              Job: {jobs.find((j) => j.id === filters.jobId)?.title || 'Unknown'}
              <button
                onClick={() => updateFilter('jobId', undefined)}
                className="hover:bg-black/10 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
