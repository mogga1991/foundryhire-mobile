'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Loader2, CheckCircle, XCircle, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export type SourcingStatus = 'idle' | 'in_progress' | 'complete' | 'error' | 'cancelled'

interface SourcingProgressProps {
  status: SourcingStatus
  candidatesFound: number
  totalExpected: number
  estimatedTimeRemaining?: number // in seconds
  errorMessage?: string
  onCancel: () => void
}

// ============================================================================
// SourcingProgress Component
// ============================================================================

export function SourcingProgress({
  status,
  candidatesFound,
  totalExpected,
  estimatedTimeRemaining,
  errorMessage,
  onCancel,
}: SourcingProgressProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0)

  const progressPercent =
    totalExpected > 0 ? Math.round((candidatesFound / totalExpected) * 100) : 0

  // Animate progress bar
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progressPercent)
    }, 100)
    return () => clearTimeout(timer)
  }, [progressPercent])

  if (status === 'idle') {
    return null
  }

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {status === 'in_progress' && (
              <>
                <Loader2 className="size-4 animate-spin text-primary" />
                Sourcing Candidates...
              </>
            )}
            {status === 'complete' && (
              <>
                <CheckCircle className="size-4 text-emerald-600" />
                Sourcing Complete
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle className="size-4 text-red-600" />
                Sourcing Failed
              </>
            )}
            {status === 'cancelled' && (
              <>
                <XCircle className="size-4 text-amber-600" />
                Sourcing Cancelled
              </>
            )}
          </CardTitle>
          {status === 'in_progress' && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress
            value={status === 'complete' ? 100 : animatedProgress}
            className={cn(
              'h-2',
              status === 'error' && '[&>[data-slot=progress-indicator]]:bg-red-500',
              status === 'cancelled' && '[&>[data-slot=progress-indicator]]:bg-amber-500',
              status === 'complete' && '[&>[data-slot=progress-indicator]]:bg-emerald-500'
            )}
          />

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Search className="size-3.5" />
              <span>
                Found{' '}
                <span className="font-medium text-foreground">
                  {candidatesFound}
                </span>{' '}
                {candidatesFound === 1 ? 'candidate' : 'candidates'}
                {status === 'in_progress' && ' so far...'}
              </span>
            </div>

            <div className="text-muted-foreground text-xs">
              {status === 'in_progress' && estimatedTimeRemaining !== undefined && (
                <span>~{formatTime(estimatedTimeRemaining)} remaining</span>
              )}
              {status === 'complete' && (
                <span className="text-emerald-600 dark:text-emerald-400">
                  {progressPercent}% of target found
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {status === 'error' && errorMessage && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-900">
            {errorMessage}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
