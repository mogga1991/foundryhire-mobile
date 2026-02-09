'use client'

/**
 * Generate Job Leads Dialog Component
 *
 * Allows users to generate candidates for a specific job.
 * Pre-fills job details and associates leads with the job.
 */

import { useState } from 'react'
import { Sparkles, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import type { Job } from '@/lib/types'

interface GenerateLeadsStats {
  totalLeads: number
  savedToDatabase: number
  emailsFound: number
  phonesFound: number
  avgDataCompleteness: number
  avgMatchScore: number
  updated: number
  duplicatesSkipped: number
}

interface GenerateJobLeadsDialogProps {
  job: Job
  onSuccess?: () => void
  trigger?: React.ReactNode
}

export function GenerateJobLeadsDialog({ job, onSuccess, trigger }: GenerateJobLeadsDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [jobTitle, setJobTitle] = useState(job.title)
  const [location, setLocation] = useState(job.location || '')
  const [maxLeads, setMaxLeads] = useState(20)
  const [stats, setStats] = useState<GenerateLeadsStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!jobTitle || !location) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)
    setError(null)
    setStats(null)

    try {
      const response = await fetch('/api/leads/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle,
          location,
          maxLeads,
          jobId: job.id,
          sources: ['linkedin', 'indeed'],
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate leads')
      }

      setStats(data.stats)

      // Reload page after 3 seconds to show new candidates
      setTimeout(() => {
        onSuccess?.()
        window.location.reload()
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setJobTitle(job.title)
    setLocation(job.location || '')
    setMaxLeads(20)
    setStats(null)
    setError(null)
    setLoading(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (!isOpen) {
          setTimeout(resetForm, 200)
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline" className="gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            Generate Leads
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate Leads for {job.title}
          </DialogTitle>
          <DialogDescription>
            Search for qualified candidates matching this role.
          </DialogDescription>
        </DialogHeader>

        {!stats ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                placeholder="e.g., Project Manager, Superintendent"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g., Austin, TX or California"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxLeads">
                Number of Candidates
              </Label>
              <Input
                id="maxLeads"
                type="number"
                min={1}
                max={50}
                value={maxLeads}
                onChange={(e) =>
                  setMaxLeads(Math.min(50, Math.max(1, parseInt(e.target.value) || 20)))
                }
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Up to 50 candidates per search.
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {loading && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching for candidates... This may take 1-2 minutes.
                </div>
                <Progress value={33} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Finding profiles, verifying contact info, and scoring matches.
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleGenerate}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Leads
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Successfully found {stats.totalLeads} candidates! {stats.savedToDatabase} added to this job.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1 rounded-lg border p-3">
                <p className="text-muted-foreground">Candidates Found</p>
                <p className="text-2xl font-bold">{stats.totalLeads}</p>
              </div>
              <div className="space-y-1 rounded-lg border p-3">
                <p className="text-muted-foreground">Avg Match Score</p>
                <p className="text-2xl font-bold">{stats.avgMatchScore}/100</p>
              </div>
              <div className="space-y-1 rounded-lg border p-3">
                <p className="text-muted-foreground">Emails Found</p>
                <p className="text-2xl font-bold">{stats.emailsFound}</p>
              </div>
              <div className="space-y-1 rounded-lg border p-3">
                <p className="text-muted-foreground">Phones Found</p>
                <p className="text-2xl font-bold">{stats.phonesFound}</p>
              </div>
            </div>

            <div className="space-y-1 rounded-lg border p-3 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>New candidates added:</span>
                <span className="font-medium text-foreground">{stats.savedToDatabase}</span>
              </div>
              <div className="flex justify-between">
                <span>Existing records updated:</span>
                <span className="font-medium text-foreground">{stats.updated || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Duplicates skipped:</span>
                <span className="font-medium text-foreground">{stats.duplicatesSkipped || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Data completeness:</span>
                <span className="font-medium text-foreground">{stats.avgDataCompleteness}%</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Page will reload in 3 seconds to show new candidates...
            </p>

            <Button
              onClick={() => setOpen(false)}
              variant="outline"
              className="w-full"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
