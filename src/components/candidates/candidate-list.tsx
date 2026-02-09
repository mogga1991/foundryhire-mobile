'use client'

import { CandidateCard } from '@/components/candidates/candidate-card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Candidate } from '@/lib/types'

// ============================================================================
// Types
// ============================================================================

interface CandidateListProps {
  candidates: Candidate[]
  jobId: string
  total: number
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  loading?: boolean
}

// ============================================================================
// CandidateList Component
// ============================================================================

export function CandidateList({
  candidates,
  jobId,
  total,
  page,
  totalPages,
  onPageChange,
  loading = false,
}: CandidateListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[88px] rounded-xl border bg-card animate-pulse"
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{total}</span>{' '}
          {total === 1 ? 'candidate' : 'candidates'} found
        </p>
        {totalPages > 1 && (
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
        )}
      </div>

      {/* Candidate Cards */}
      <div className="space-y-3">
        {candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            jobId={jobId}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] min-w-[44px]"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              let pageNum: number

              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (page <= 3) {
                pageNum = i + 1
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = page - 2 + i
              }

              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? 'default' : 'outline'}
                  size="sm"
                  className="w-10 h-10 sm:w-9 sm:h-9 p-0"
                  onClick={() => onPageChange(pageNum)}
                >
                  {pageNum}
                </Button>
              )
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] min-w-[44px]"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
