'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { MatchScoreBadge } from '@/components/ui/match-score-badge'
import { SourceBadge } from '@/components/ui/source-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import type { Candidate } from '@/lib/types'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

type SortField = 'name' | 'email' | 'score' | 'status' | 'source' | 'createdAt'
type SortDirection = 'asc' | 'desc' | null

interface CandidateTableProps {
  candidates: Candidate[]
  jobId?: string
  onRowClick?: (candidate: Candidate) => void
  onSelectionChange?: (selectedIds: string[]) => void
  initialSort?: {
    field: SortField
    direction: 'asc' | 'desc'
  }
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  loading?: boolean
  className?: string
}

// ============================================================================
// CandidateTable Component
// ============================================================================

export function CandidateTable({
  candidates,
  jobId,
  onRowClick,
  onSelectionChange,
  initialSort,
  page = 1,
  totalPages = 1,
  onPageChange,
  loading = false,
  className,
}: CandidateTableProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [sortField, setSortField] = React.useState<SortField | null>(
    initialSort?.field || null
  )
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(
    initialSort?.direction || null
  )

  // ============================================================================
  // Selection Handlers
  // ============================================================================

  const handleSelectAll = React.useCallback(() => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set())
      onSelectionChange?.([])
    } else {
      const allIds = new Set(candidates.map((c) => c.id))
      setSelectedIds(allIds)
      onSelectionChange?.(Array.from(allIds))
    }
  }, [candidates, selectedIds.size, onSelectionChange])

  const handleSelectRow = React.useCallback(
    (id: string) => {
      const newSelectedIds = new Set(selectedIds)
      if (newSelectedIds.has(id)) {
        newSelectedIds.delete(id)
      } else {
        newSelectedIds.add(id)
      }
      setSelectedIds(newSelectedIds)
      onSelectionChange?.(Array.from(newSelectedIds))
    },
    [selectedIds, onSelectionChange]
  )

  // ============================================================================
  // Sort Handlers
  // ============================================================================

  const handleSort = React.useCallback(
    (field: SortField) => {
      if (sortField === field) {
        // Cycle through: asc -> desc -> null
        if (sortDirection === 'asc') {
          setSortDirection('desc')
        } else if (sortDirection === 'desc') {
          setSortField(null)
          setSortDirection(null)
        }
      } else {
        setSortField(field)
        setSortDirection('asc')
      }
    },
    [sortField, sortDirection]
  )

  // ============================================================================
  // Sorted Data
  // ============================================================================

  const sortedCandidates = React.useMemo(() => {
    if (!sortField || !sortDirection) return candidates

    return [...candidates].sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (sortField) {
        case 'name':
          aVal = `${a.firstName} ${a.lastName}`.toLowerCase()
          bVal = `${b.firstName} ${b.lastName}`.toLowerCase()
          break
        case 'email':
          aVal = (a.email || '').toLowerCase()
          bVal = (b.email || '').toLowerCase()
          break
        case 'score':
          aVal = a.aiScore || 0
          bVal = b.aiScore || 0
          break
        case 'status':
          aVal = a.status.toLowerCase()
          bVal = b.status.toLowerCase()
          break
        case 'source':
          aVal = (a.source || 'manual').toLowerCase()
          bVal = (b.source || 'manual').toLowerCase()
          break
        case 'createdAt':
          aVal = new Date(a.createdAt).getTime()
          bVal = new Date(b.createdAt).getTime()
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [candidates, sortField, sortDirection])

  // ============================================================================
  // Row Click Handler
  // ============================================================================

  const handleRowClick = React.useCallback(
    (candidate: Candidate, event: React.MouseEvent) => {
      // Don't trigger row click if clicking on checkbox
      const target = event.target as HTMLElement
      if (target.closest('[role="checkbox"]')) {
        return
      }

      if (onRowClick) {
        onRowClick(candidate)
      } else if (jobId) {
        router.push(`/jobs/${jobId}/candidates/${candidate.id}`)
      } else {
        router.push(`/candidates/${candidate.id}`)
      }
    },
    [onRowClick, jobId, router]
  )

  // ============================================================================
  // Render Sort Icon
  // ============================================================================

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="size-4 text-muted-foreground" />
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="size-4" />
    }
    return <ChevronDown className="size-4" />
  }

  // ============================================================================
  // Loading State
  // ============================================================================

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="h-12 bg-muted/50 animate-pulse" />
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-16 border-t animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // ============================================================================
  // Empty State
  // ============================================================================

  if (!candidates.length) {
    return (
      <div className={cn("rounded-xl border bg-card", className)}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground">No candidates found</p>
        </div>
      </div>
    )
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  const isAllSelected = selectedIds.size === candidates.length && candidates.length > 0
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < candidates.length

  return (
    <div className={cn("space-y-4", className)}>
      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  data-state={isSomeSelected ? 'indeterminate' : isAllSelected ? 'checked' : 'unchecked'}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all candidates"
                />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  Name
                  {renderSortIcon('name')}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort('email')}
              >
                <div className="flex items-center gap-2">
                  Email
                  {renderSortIcon('email')}
                </div>
              </TableHead>
              <TableHead>Current Position</TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort('score')}
              >
                <div className="flex items-center gap-2">
                  Match
                  {renderSortIcon('score')}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-2">
                  Status
                  {renderSortIcon('status')}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort('source')}
              >
                <div className="flex items-center gap-2">
                  Source
                  {renderSortIcon('source')}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCandidates.map((candidate) => (
              <TableRow
                key={candidate.id}
                data-state={selectedIds.has(candidate.id) ? 'selected' : undefined}
                className="cursor-pointer"
                onClick={(e) => handleRowClick(candidate, e)}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(candidate.id)}
                    onCheckedChange={() => handleSelectRow(candidate.id)}
                    aria-label={`Select ${candidate.firstName} ${candidate.lastName}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-8 shrink-0">
                      {candidate.profileImageUrl && (
                        <AvatarImage src={candidate.profileImageUrl} alt={`${candidate.firstName} ${candidate.lastName}`} />
                      )}
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {candidate.firstName.charAt(0)}{candidate.lastName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{candidate.firstName} {candidate.lastName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {candidate.email || <span className="text-muted-foreground/50 italic">No email yet</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex flex-col">
                    {candidate.currentTitle && (
                      <span className="text-sm">{candidate.currentTitle}</span>
                    )}
                    {candidate.currentCompany && (
                      <span className="text-xs text-muted-foreground">
                        {candidate.currentCompany}
                      </span>
                    )}
                    {!candidate.currentTitle && !candidate.currentCompany && (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {candidate.aiScore !== null && candidate.aiScore !== undefined ? (
                    <MatchScoreBadge score={candidate.aiScore} />
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={candidate.status} />
                </TableCell>
                <TableCell>
                  <SourceBadge source={candidate.source || 'manual'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {selectedIds.size > 0 && (
              <span className="font-medium text-foreground">
                {selectedIds.size} selected
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
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
                    className="w-9 h-9 p-0"
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
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
