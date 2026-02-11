'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import {
  MapPin,
  Users,
  Clock,
  Building2,
  Eye,
  Sparkles,
  Edit,
  MoreVertical,
  Archive,
  Copy,
  Trash2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { GenerateJobLeadsDialog } from '@/components/jobs/generate-job-leads-dialog'
import type { Job } from '@/lib/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface JobCardProps {
  job: Job
  candidateCount?: number
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  draft: {
    label: 'Draft',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400',
  },
  closed: {
    label: 'Closed',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
}

export function JobCard({ job, candidateCount = 0 }: JobCardProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)

  const status = statusConfig[job.status] ?? statusConfig.draft
  const postedAgo = formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault()
    e.stopPropagation()
    action()
  }

  const handleDuplicate = async () => {
    setIsDuplicating(true)
    try {
      const response = await fetch(`/api/jobs/${job.id}/duplicate`, {
        method: 'POST',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to duplicate job')
      }

      toast.success('Job duplicated successfully')
      router.refresh()
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to duplicate job:', error)
      }
      toast.error(error instanceof Error ? error.message : 'Failed to duplicate job')
    } finally {
      setIsDuplicating(false)
    }
  }

  const handleArchive = async () => {
    setIsArchiving(true)
    try {
      const response = await fetch(`/api/jobs/${job.id}/archive`, {
        method: 'POST',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to archive job')
      }

      toast.success('Job archived successfully')
      setShowArchiveDialog(false)
      router.refresh()
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to archive job:', error)
      }
      toast.error(error instanceof Error ? error.message : 'Failed to archive job')
    } finally {
      setIsArchiving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete job')
      }

      toast.success('Job deleted successfully')
      setShowDeleteDialog(false)
      router.refresh()
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to delete job:', error)
      }
      toast.error(error instanceof Error ? error.message : 'Failed to delete job')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className="group transition-all hover:shadow-md hover:border-primary/20 flex flex-col">
      <Link href={`/jobs/${job.id}`} className="cursor-pointer flex-1">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-xl font-bold leading-tight group-hover:text-primary transition-colors line-clamp-2">
              {job.title}
            </CardTitle>
            <Badge variant="secondary" className={cn('shrink-0', status.className)}>
              {status.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 flex-1">
          <div className="flex flex-col gap-2">
            {(job.location || job.department) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                {job.location && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 shrink-0" />
                      <span className="truncate">{job.location}</span>
                    </div>
                  </>
                )}
                {job.location && job.department && <span>|</span>}
                {job.department && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="size-3.5 shrink-0" />
                    <span>{job.department}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="gap-1">
                <Users className="size-3" />
                <span className="font-semibold">{candidateCount}</span>
                <span className="text-xs">
                  {candidateCount === 1 ? 'candidate' : 'candidates'}
                </span>
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3" />
              <span>{postedAgo}</span>
            </div>
          </div>
        </CardContent>
      </Link>

      <CardContent className="pt-0 border-t">
        <div className="flex gap-2 pt-3" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={(e) => handleAction(e, () => router.push(`/jobs/${job.id}/candidates`))}
          >
            <Eye className="size-3.5 mr-1.5" />
            View Candidates
          </Button>

          {job.status === 'active' && (
            <GenerateJobLeadsDialog
              job={job}
              trigger={
                <Button variant="default" size="sm" className="flex-1">
                  <Sparkles className="size-3.5 mr-1.5" />
                  Generate Leads
                </Button>
              }
            />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="px-2">
                <MoreVertical className="size-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => handleAction(e, () => router.push(`/jobs/${job.id}/edit`))}
              >
                <Edit className="size-4 mr-2" />
                Edit Job
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => handleAction(e, handleDuplicate)}
                disabled={isDuplicating}
              >
                <Copy className="size-4 mr-2" />
                {isDuplicating ? 'Duplicating...' : 'Duplicate'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => handleAction(e, () => setShowArchiveDialog(true))}
                disabled={job.status === 'closed'}
              >
                <Archive className="size-4 mr-2" />
                {job.status === 'closed' ? 'Archived' : 'Archive'}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => handleAction(e, () => setShowDeleteDialog(true))}
              >
                <Trash2 className="size-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this job?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the job to the closed status. You can reactivate it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={isArchiving}>
              {isArchiving ? 'Archiving...' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the job posting.
              {candidateCount > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  Warning: This job has {candidateCount} linked candidate{candidateCount > 1 ? 's' : ''}.
                  You must unlink all candidates before deleting.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting || candidateCount > 0}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
