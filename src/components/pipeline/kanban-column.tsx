'use client'

import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { KanbanCard } from './kanban-card'
import type { Candidate } from '@/lib/types'

export interface PipelineStatus {
  id: string
  label: string
  color: string
}

interface KanbanColumnProps {
  status: PipelineStatus
  candidates: Candidate[]
  jobId: string
  isActiveDropTarget: boolean
}

const COLOR_MAP: Record<string, {
  border: string
  bg: string
  badge: string
  dropHighlight: string
}> = {
  blue: {
    border: 'border-t-blue-500',
    bg: 'bg-blue-50/50',
    badge: 'bg-blue-100 text-blue-700',
    dropHighlight: 'bg-blue-50 ring-2 ring-blue-300',
  },
  yellow: {
    border: 'border-t-yellow-500',
    bg: 'bg-yellow-50/50',
    badge: 'bg-yellow-100 text-yellow-700',
    dropHighlight: 'bg-yellow-50 ring-2 ring-yellow-300',
  },
  green: {
    border: 'border-t-green-500',
    bg: 'bg-green-50/50',
    badge: 'bg-green-100 text-green-700',
    dropHighlight: 'bg-green-50 ring-2 ring-green-300',
  },
  purple: {
    border: 'border-t-purple-500',
    bg: 'bg-purple-50/50',
    badge: 'bg-purple-100 text-purple-700',
    dropHighlight: 'bg-purple-50 ring-2 ring-purple-300',
  },
  orange: {
    border: 'border-t-orange-500',
    bg: 'bg-orange-50/50',
    badge: 'bg-orange-100 text-orange-700',
    dropHighlight: 'bg-orange-50 ring-2 ring-orange-300',
  },
  emerald: {
    border: 'border-t-emerald-500',
    bg: 'bg-emerald-50/50',
    badge: 'bg-emerald-100 text-emerald-700',
    dropHighlight: 'bg-emerald-50 ring-2 ring-emerald-300',
  },
  red: {
    border: 'border-t-red-500',
    bg: 'bg-red-50/50',
    badge: 'bg-red-100 text-red-700',
    dropHighlight: 'bg-red-50 ring-2 ring-red-300',
  },
}

export function KanbanColumn({
  status,
  candidates,
  jobId,
  isActiveDropTarget,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
    data: {
      type: 'column',
      status: status.id,
    },
  })

  const colors = COLOR_MAP[status.color] ?? COLOR_MAP.blue
  const candidateIds = candidates.map((c) => c.id)
  const showHighlight = isOver || isActiveDropTarget

  return (
    <div
      className={cn(
        'flex h-full w-[300px] flex-shrink-0 flex-col rounded-xl border border-t-4 bg-muted/30 transition-all duration-200',
        colors.border,
        showHighlight && colors.dropHighlight
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {status.label}
          </h3>
          <Badge
            variant="secondary"
            className={cn(
              'px-1.5 py-0 text-[11px] font-semibold leading-5',
              colors.badge
            )}
          >
            {candidates.length}
          </Badge>
        </div>
      </div>

      {/* Scrollable candidate list */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 transition-colors duration-200',
          showHighlight && 'rounded-b-xl',
          candidates.length === 0 && 'items-center justify-center'
        )}
        style={{ minHeight: '120px', maxHeight: 'calc(100vh - 320px)' }}
      >
        <SortableContext
          items={candidateIds}
          strategy={verticalListSortingStrategy}
        >
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-sm text-muted-foreground/60">
                No candidates
              </p>
              <p className="mt-1 text-xs text-muted-foreground/40">
                Drag candidates here
              </p>
            </div>
          ) : (
            candidates.map((candidate) => (
              <KanbanCard
                key={candidate.id}
                candidate={candidate}
                jobId={jobId}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  )
}
