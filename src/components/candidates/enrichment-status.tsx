'use client'

/**
 * Enrichment Status Component
 *
 * Shows the progressive enrichment queue status for the company's candidates.
 * Displays pending/completed/failed counts and allows manual triggering.
 */

import { useState, useEffect } from 'react'
import { RefreshCw, Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface EnrichmentStatusData {
  pending: number
  inProgress: number
  completed: number
  failed: number
  totalCandidates: number
  avgCompleteness: number
}

export function EnrichmentStatus() {
  const [status, setStatus] = useState<EnrichmentStatusData | null>(null)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/enrichment/status')
      const data = await response.json()
      if (data.success) {
        setStatus(data)
      }
    } catch {
      // Silently fail - not critical
    }
  }

  useEffect(() => {
    fetchStatus()
    // Poll every 30 seconds
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleProcess = async () => {
    setProcessing(true)
    setError(null)

    try {
      // Process in a loop until no more tasks are processed or remaining is 0
      let totalProcessed = 0
      let totalSucceeded = 0
      let totalFailed = 0
      let remaining = 1 // start truthy

      while (remaining > 0) {
        const response = await fetch('/api/enrichment/process', {
          method: 'POST',
        })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to process enrichment')
        }

        totalProcessed += data.processed || 0
        totalSucceeded += data.succeeded || 0
        totalFailed += data.failed || 0
        remaining = data.remaining || 0

        // Stop if nothing was processed (all tasks are rate-limited or deferred)
        if ((data.processed || 0) === 0) break

        // Refresh status between batches so the UI updates
        await fetchStatus()
      }

      // Final refresh
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setProcessing(false)
    }
  }

  if (!status || (status.pending === 0 && status.completed === 0 && status.failed === 0)) {
    return null // Don't show if no enrichment tasks exist
  }

  const total = status.pending + status.inProgress + status.completed + status.failed
  const completionPercent = total > 0 ? Math.round((status.completed / total) * 100) : 0

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Enrichment Queue</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleProcess}
          disabled={processing || status.pending === 0}
        >
          {processing ? (
            <>
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              Processing...
            </>
          ) : (
            'Run Now'
          )}
        </Button>
      </div>

      <Progress value={completionPercent} className="h-2" />

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{status.pending} pending</span>
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-green-500" />
          <span>{status.completed} completed</span>
        </div>
        {status.failed > 0 && (
          <div className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-red-500" />
            <span>{status.failed} failed</span>
          </div>
        )}
        <div className="ml-auto">
          <span>Avg completeness: {status.avgCompleteness}%</span>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
