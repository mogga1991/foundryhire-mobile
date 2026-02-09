'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { KanbanColumn, type PipelineStatus } from './kanban-column'
import { KanbanCard } from './kanban-card'
import type { Candidate } from '@/lib/types'

export const PIPELINE_STATUSES: PipelineStatus[] = [
  { id: 'new', label: 'New', color: 'blue' },
  { id: 'contacted', label: 'Contacted', color: 'yellow' },
  { id: 'responded', label: 'Responded', color: 'green' },
  { id: 'interviewing', label: 'Interviewing', color: 'purple' },
  { id: 'offer', label: 'Offer', color: 'orange' },
  { id: 'hired', label: 'Hired', color: 'emerald' },
  { id: 'rejected', label: 'Rejected', color: 'red' },
]

interface KanbanBoardProps {
  candidates: Candidate[]
  jobId: string
  onStatusChange: (candidateId: string, newStatus: string) => Promise<void>
}

export function KanbanBoard({
  candidates,
  jobId,
  onStatusChange,
}: KanbanBoardProps) {
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null)
  const [activeOverColumn, setActiveOverColumn] = useState<string | null>(null)
  const [optimisticCandidates, setOptimisticCandidates] = useState<Candidate[]>(candidates)

  // Keep optimistic candidates in sync when the parent prop changes
  // (e.g., after a refetch following a successful update)
  const candidatesKey = candidates.map((c) => `${c.id}:${c.status}`).join(',')
  const [prevKey, setPrevKey] = useState(candidatesKey)
  if (candidatesKey !== prevKey) {
    setPrevKey(candidatesKey)
    setOptimisticCandidates(candidates)
  }

  // Group candidates by status
  const candidatesByStatus = useMemo(() => {
    const grouped: Record<string, Candidate[]> = {}
    for (const status of PIPELINE_STATUSES) {
      grouped[status.id] = []
    }
    for (const candidate of optimisticCandidates) {
      const statusKey = candidate.status?.toLowerCase() ?? 'new'
      if (grouped[statusKey]) {
        grouped[statusKey].push(candidate)
      } else {
        // Fallback: put in 'new' if status doesn't match any column
        grouped['new'].push(candidate)
      }
    }
    return grouped
  }, [optimisticCandidates])

  // Sensors for drag interactions
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Find which column a candidate currently belongs to
  const findCandidateColumn = useCallback(
    (candidateId: string): string | null => {
      for (const [statusId, statusCandidates] of Object.entries(candidatesByStatus)) {
        if (statusCandidates.some((c) => c.id === candidateId)) {
          return statusId
        }
      }
      return null
    },
    [candidatesByStatus]
  )

  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    const candidate = optimisticCandidates.find((c) => c.id === active.id)
    if (candidate) {
      setActiveCandidate(candidate)
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event
    if (!over) {
      setActiveOverColumn(null)
      return
    }

    // Determine the target column: either the column itself or the column of a candidate
    const overData = over.data.current
    if (overData?.type === 'column') {
      setActiveOverColumn(over.id as string)
    } else if (overData?.type === 'candidate') {
      const column = findCandidateColumn(over.id as string)
      setActiveOverColumn(column)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    setActiveCandidate(null)
    setActiveOverColumn(null)

    if (!over) return

    const candidateId = active.id as string
    const overData = over.data.current

    // Determine the destination column
    let destinationStatus: string | null = null

    if (overData?.type === 'column') {
      destinationStatus = over.id as string
    } else if (overData?.type === 'candidate') {
      destinationStatus = findCandidateColumn(over.id as string)
    }

    if (!destinationStatus) return

    // Check if status actually changed
    const currentStatus = findCandidateColumn(candidateId)
    if (currentStatus === destinationStatus) return

    // Optimistic update: move candidate to new column immediately
    setOptimisticCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId
          ? { ...c, status: destinationStatus as string, updatedAt: new Date() }
          : c
      )
    )

    // Persist via API
    try {
      await onStatusChange(candidateId, destinationStatus)
    } catch {
      // Revert on failure
      setOptimisticCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId && currentStatus
            ? { ...c, status: currentStatus, updatedAt: c.updatedAt }
            : c
        )
      )
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {PIPELINE_STATUSES.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            candidates={candidatesByStatus[status.id] ?? []}
            jobId={jobId}
            isActiveDropTarget={activeOverColumn === status.id}
          />
        ))}
      </div>

      {/* Drag overlay: the floating card shown while dragging */}
      <DragOverlay dropAnimation={null}>
        {activeCandidate ? (
          <KanbanCard
            candidate={activeCandidate}
            jobId={jobId}
            isDragOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
