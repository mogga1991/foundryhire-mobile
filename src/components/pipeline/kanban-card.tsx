'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'
import { GripVertical, Linkedin, Globe, FileText, Star } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Candidate } from '@/lib/types'

interface KanbanCardProps {
  candidate: Candidate
  jobId: string
  isDragOverlay?: boolean
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function getScoreColor(score: number | null): string {
  if (score === null || score === undefined) return 'bg-gray-100 text-gray-600'
  if (score >= 80) return 'bg-emerald-100 text-emerald-700'
  if (score >= 60) return 'bg-blue-100 text-blue-700'
  if (score >= 40) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

function getSourceIcon(source: string | null) {
  switch (source?.toLowerCase()) {
    case 'linkedin':
      return <Linkedin className="size-3.5 text-[#0A66C2]" />
    case 'indeed':
    case 'website':
      return <Globe className="size-3.5 text-muted-foreground" />
    case 'manual':
    case 'referral':
      return <FileText className="size-3.5 text-muted-foreground" />
    default:
      return <FileText className="size-3.5 text-muted-foreground" />
  }
}

function getDaysInStatus(updatedAt: string | Date): number {
  const updated = new Date(updatedAt)
  const now = new Date()
  const diffMs = now.getTime() - updated.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

export function KanbanCard({ candidate, jobId, isDragOverlay = false }: KanbanCardProps) {
  const router = useRouter()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: candidate.id,
    data: {
      type: 'candidate',
      candidate,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const daysInStatus = getDaysInStatus(candidate.updatedAt)

  function handleCardClick(e: React.MouseEvent) {
    // Don't navigate when dragging
    if (isDragging) return
    // Don't navigate when clicking the grip handle
    const target = e.target as HTMLElement
    if (target.closest('[data-drag-handle]')) return
    router.push(`/jobs/${jobId}/candidates/${candidate.id}`)
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      onClick={handleCardClick}
      className={cn(
        'group/card cursor-pointer border bg-card p-3 shadow-sm transition-all hover:shadow-md hover:border-primary/20',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary/20',
        isDragOverlay && 'rotate-[2deg] shadow-xl ring-2 ring-primary/30',
        '!gap-0 !py-3 !rounded-lg'
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Drag handle */}
        <button
          data-drag-handle
          className="mt-0.5 flex-shrink-0 cursor-grab rounded p-0.5 text-muted-foreground/40 opacity-0 transition-opacity hover:text-muted-foreground group-hover/card:opacity-100 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        {/* Avatar */}
        <Avatar size="sm" className="mt-0.5 flex-shrink-0">
          <AvatarFallback className="bg-slate-100 text-xs font-medium text-slate-600">
            {getInitials(candidate.firstName, candidate.lastName)}
          </AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1.5">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {candidate.firstName} {candidate.lastName}
            </p>
            {candidate.aiScore !== null && candidate.aiScore !== undefined && (
              <Badge
                variant="secondary"
                className={cn(
                  'flex-shrink-0 px-1.5 py-0 text-[10px] font-semibold leading-5',
                  getScoreColor(candidate.aiScore)
                )}
              >
                <Star className="mr-0.5 size-2.5" />
                {candidate.aiScore}
              </Badge>
            )}
          </div>

          {candidate.currentTitle && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {candidate.currentTitle}
            </p>
          )}

          {candidate.currentCompany && (
            <p className="truncate text-xs text-muted-foreground/70">
              {candidate.currentCompany}
            </p>
          )}

          {/* Bottom row: source and days in status */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {getSourceIcon(candidate.source)}
              <span className="text-[10px] capitalize text-muted-foreground">
                {candidate.source ?? 'Unknown'}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground/60">
              {daysInStatus === 0
                ? 'Today'
                : daysInStatus === 1
                  ? '1 day'
                  : `${daysInStatus} days`}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
