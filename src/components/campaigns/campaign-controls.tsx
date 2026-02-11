'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Pause,
  Play,
  XCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'

interface CampaignControlsProps {
  campaignId: string
  status: CampaignStatus
  totalSent: number
  totalRecipients: number
  onStatusChange?: (newStatus: CampaignStatus) => void
}

const statusConfig: Record<
  CampaignStatus,
  { label: string; className: string; dotColor: string }
> = {
  draft: {
    label: 'Draft',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    dotColor: 'bg-gray-400',
  },
  scheduled: {
    label: 'Scheduled',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    dotColor: 'bg-blue-500',
  },
  sending: {
    label: 'Sending',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    dotColor: 'bg-amber-500 animate-pulse',
  },
  active: {
    label: 'Active',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    dotColor: 'bg-green-500 animate-pulse',
  },
  paused: {
    label: 'Paused',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    dotColor: 'bg-yellow-500',
  },
  completed: {
    label: 'Completed',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    dotColor: 'bg-purple-500',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    dotColor: 'bg-red-500',
  },
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const config = statusConfig[status] || statusConfig.draft

  return (
    <Badge className={cn('gap-1.5', config.className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dotColor)} />
      {config.label}
    </Badge>
  )
}

export function CampaignControls({
  campaignId,
  status,
  totalSent,
  totalRecipients,
  onStatusChange,
}: CampaignControlsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  const progressPercent =
    totalRecipients > 0 ? Math.round((totalSent / totalRecipients) * 100) : 0

  const canPause = status === 'sending' || status === 'scheduled' || status === 'active'
  const canResume = status === 'paused'
  const canCancel =
    status === 'sending' ||
    status === 'scheduled' ||
    status === 'paused' ||
    status === 'active'

  async function updateStatus(newStatus: CampaignStatus) {
    setLoading(newStatus)
    try {
      const res = await fetch(`/api/campaigns?id=${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `Failed to update campaign status`)
      }

      const actionLabel =
        newStatus === 'paused'
          ? 'paused'
          : newStatus === 'sending' || newStatus === 'active'
            ? 'resumed'
            : 'cancelled'
      toast.success(`Campaign ${actionLabel}`)
      onStatusChange?.(newStatus)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(message)
    } finally {
      setLoading(null)
      setCancelOpen(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Status & progress */}
      <div className="flex items-center justify-between">
        <CampaignStatusBadge status={status} />
        <span className="text-sm text-muted-foreground">
          {totalSent} / {totalRecipients} sent
        </span>
      </div>

      {/* Progress bar */}
      {totalRecipients > 0 && (
        <div className="space-y-1">
          <Progress value={progressPercent} className="h-2" />
          <p className="text-right text-xs text-muted-foreground">
            {progressPercent}% complete
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {canPause && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateStatus('paused')}
            disabled={loading !== null}
            aria-label="Pause campaign"
          >
            {loading === 'paused' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
            Pause
          </Button>
        )}

        {canResume && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateStatus('sending')}
            disabled={loading !== null}
            aria-label="Resume campaign"
          >
            {loading === 'sending' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Resume
          </Button>
        )}

        {canCancel && (
          <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
            <DialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={loading !== null}
                aria-label="Cancel campaign"
              >
                <XCircle className="h-4 w-4" />
                Cancel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Cancel Campaign
                </DialogTitle>
                <DialogDescription>
                  Are you sure you want to cancel this campaign? This action
                  cannot be undone. Emails that have already been sent will not
                  be recalled, but remaining unsent emails will not be
                  delivered.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCancelOpen(false)}
                >
                  Keep Running
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => updateStatus('cancelled')}
                  disabled={loading !== null}
                >
                  {loading === 'cancelled' && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Yes, Cancel Campaign
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}
