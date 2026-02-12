'use client'

/**
 * Lead Pool CSV Import Dialog
 *
 * Imports leads into Supabase `public.leads` (lead pool) for fallback matching.
 * Supports the Apify leads-scraper-ppe CSV format.
 */

import { useRef, useState } from 'react'
import { Upload, Loader2, CheckCircle, AlertCircle, Database, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { getCsrfToken } from '@/lib/client/csrf'

interface LeadPoolImportResult {
  totalRows: number
  validRows: number
  insertedOrUpdated: number
  skippedInvalid: number
  errors: Array<{ row: number; error: string }>
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export function LeadPoolImportDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState('')
  const [result, setResult] = useState<LeadPoolImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      if (!selected.name.toLowerCase().endsWith('.csv')) {
        setError('Please select a CSV file')
        return
      }
      if (selected.size > 50 * 1024 * 1024) {
        setError('File must be under 50MB')
        return
      }
      setFile(selected)
      setError(null)
    }
  }

  const handleImport = async () => {
    if (!file) {
      setError('Please select a CSV file')
      return
    }
    const trimmedJobId = jobId.trim()
    if (trimmedJobId && !isUuid(trimmedJobId)) {
      setError('Job ID must be a UUID (or leave it blank)')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const csrfToken = await getCsrfToken()
      const formData = new FormData()
      formData.append('file', file)
      if (trimmedJobId) formData.append('jobId', trimmedJobId)

      const response = await fetch('/api/leads/pool/import', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to import lead pool CSV')
      }

      // Route returns `{ success: true, ...result }`
      setResult({
        totalRows: data.totalRows ?? 0,
        validRows: data.validRows ?? 0,
        insertedOrUpdated: data.insertedOrUpdated ?? 0,
        skippedInvalid: data.skippedInvalid ?? 0,
        errors: data.errors ?? [],
      })

      // Optional: reload to reflect any UI that depends on lead pool stats
      setTimeout(() => window.location.reload(), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFile(null)
    setJobId('')
    setResult(null)
    setError(null)
    setLoading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (!isOpen) setTimeout(resetForm, 200)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Database className="h-4 w-4" />
          Lead Pool
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import Lead Pool CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV of leads to populate your fallback lead pool (Supabase). Supports Apify leads-scraper-ppe.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>CSV File</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {file ? (
                  <div className="space-y-1">
                    <FileSpreadsheet className="h-8 w-8 text-primary mx-auto" />
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">Click to select a CSV file</p>
                    <p className="text-xs text-muted-foreground">Max 50MB, .csv format</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobId">Associate With Job (Optional)</Label>
              <Input
                id="jobId"
                placeholder="Job UUID (leave blank to import unassigned)"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                If provided, searches can filter by this job. Otherwise leads are stored at the company level.
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
                  Importing lead pool... This may take a moment for large files.
                </div>
                <Progress value={50} className="h-2" />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={handleImport} disabled={loading || !file} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Import Lead Pool
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Imported lead pool rows into Supabase.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1 rounded-lg border p-3">
                <p className="text-muted-foreground">Total Rows</p>
                <p className="text-2xl font-bold">{result.totalRows}</p>
              </div>
              <div className="space-y-1 rounded-lg border p-3">
                <p className="text-muted-foreground">Valid Rows</p>
                <p className="text-2xl font-bold">{result.validRows}</p>
              </div>
              <div className="space-y-1 rounded-lg border p-3">
                <p className="text-muted-foreground">Upserted</p>
                <p className="text-2xl font-bold text-green-600">{result.insertedOrUpdated}</p>
              </div>
              <div className="space-y-1 rounded-lg border p-3">
                <p className="text-muted-foreground">Skipped Invalid</p>
                <p className="text-2xl font-bold text-muted-foreground">{result.skippedInvalid}</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2 rounded-lg border p-3 text-xs">
                <p className="font-medium text-muted-foreground">
                  Errors: <span className="text-red-600">{result.errors.length}</span>
                </p>
                <div className="max-h-40 overflow-auto text-muted-foreground">
                  {result.errors.slice(0, 20).map((e, idx) => (
                    <div key={idx}>
                      Row {e.row}: {e.error}
                    </div>
                  ))}
                  {result.errors.length > 20 && <div>…and more</div>}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
              Page will reload in a moment.
            </p>

            <Button onClick={() => setOpen(false)} variant="outline" className="w-full">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

