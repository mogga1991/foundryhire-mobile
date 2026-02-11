'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Calendar, Clock, User, Briefcase, ChevronLeft, ChevronRight } from 'lucide-react'
import { InterviewFilters, InterviewFilterState } from './interview-filters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Interview {
  id: string
  candidateId: string
  jobId: string | null
  scheduledAt: string
  durationMinutes: number
  status: string
  candidateFirstName: string | null
  candidateLastName: string | null
  candidateEmail: string | null
  jobTitle: string | null
}

interface PaginatedResponse {
  interviews: Interview[]
  total: number
  page: number
  totalPages: number
  limit: number
}

export function InterviewListWithFilters() {
  const [data, setData] = useState<PaginatedResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [filters, setFilters] = useState<InterviewFilterState>({
    status: [],
    page: 1,
    limit: 20,
  })

  const fetchInterviews = useCallback(async (filterState: InterviewFilterState) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()

      if (filterState.status.length > 0) {
        params.set('status', filterState.status.join(','))
      }
      if (filterState.startDate) {
        params.set('startDate', filterState.startDate)
      }
      if (filterState.endDate) {
        params.set('endDate', filterState.endDate)
      }
      if (filterState.search) {
        params.set('search', filterState.search)
      }
      if (filterState.jobId) {
        params.set('jobId', filterState.jobId)
      }
      params.set('page', String(filterState.page || 1))
      params.set('limit', String(filterState.limit || 20))

      const res = await fetch(`/api/interviews?${params.toString()}`)
      if (res.ok) {
        const result = await res.json()
        setData(result)
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to fetch interviews:', err)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleFilterChange = useCallback((newFilters: InterviewFilterState) => {
    setFilters(newFilters)
    fetchInterviews(newFilters)
  }, [fetchInterviews])

  const goToPage = (page: number) => {
    const newFilters = { ...filters, page }
    setFilters(newFilters)
    fetchInterviews(newFilters)
  }

  // Initial load
  useState(() => {
    fetchInterviews(filters)
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800'
      case 'in_progress':
        return 'bg-orange-100 text-orange-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <InterviewFilters
        onFilterChange={handleFilterChange}
        initialFilters={filters}
      />

      {/* Results Count */}
      {data && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Showing {((data.page - 1) * data.limit) + 1} to {Math.min(data.page * data.limit, data.total)} of {data.total} interviews
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading interviews...</p>
        </div>
      )}

      {/* Interview List */}
      {!isLoading && data && (
        <div className="space-y-3">
          {data.interviews.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No interviews found</h3>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your filters or schedule a new interview
                </p>
              </CardContent>
            </Card>
          ) : (
            data.interviews.map((interview) => {
              const scheduledDate = new Date(interview.scheduledAt)
              const candidateName = `${interview.candidateFirstName || ''} ${interview.candidateLastName || ''}`.trim() || 'Unknown Candidate'

              return (
                <Link key={interview.id} href={`/interviews/${interview.id}`}>
                  <Card className="hover:border-orange-300 transition cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {candidateName}
                            </h3>
                            <Badge className={getStatusColor(interview.status)}>
                              {interview.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {scheduledDate.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {scheduledDate.toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </div>
                            {interview.jobTitle && (
                              <div className="flex items-center gap-1">
                                <Briefcase className="h-4 w-4" />
                                {interview.jobTitle}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })
          )}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(data.page - 1)}
            disabled={data.page === 1 || isLoading}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {Array.from({ length: Math.min(data.totalPages, 5) }, (_, i) => {
              let pageNum: number
              if (data.totalPages <= 5) {
                pageNum = i + 1
              } else if (data.page <= 3) {
                pageNum = i + 1
              } else if (data.page >= data.totalPages - 2) {
                pageNum = data.totalPages - 4 + i
              } else {
                pageNum = data.page - 2 + i
              }

              return (
                <Button
                  key={pageNum}
                  variant={data.page === pageNum ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => goToPage(pageNum)}
                  disabled={isLoading}
                  className={cn(
                    'min-w-[40px]',
                    data.page === pageNum && 'bg-orange-500 hover:bg-orange-600'
                  )}
                >
                  {pageNum}
                </Button>
              )
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(data.page + 1)}
            disabled={data.page === data.totalPages || isLoading}
            className="gap-2"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
