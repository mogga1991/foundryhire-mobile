'use client'

/**
 * CSV Import Dialog Component
 *
 * Allows users to upload a CSV file (e.g. from Apify leads-scraper-ppe)
 * to bulk import candidates with deduplication.
 */

import { useState, useRef } from 'react'
import { Upload, Loader2, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CsvImportResult {
  totalRows: number
  validRows: number
  skippedNoEmail: number
  inserted: number
  updated: number
  duplicatesSkipped: number
  errors: string[]
}

export function CsvImportDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [mergeStrategy, setMergeStrategy] = useState<string>('merge_best')
  const [result, setResult] = useState<CsvImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      if (!selected.name.endsWith('.csv')) {
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

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mergeStrategy', mergeStrategy)

      const response = await fetch('/api/candidates/import', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import CSV')
      }

      setResult(data.result)

      // Reload page after 3 seconds to show new candidates
      setTimeout(() => {
        window.location.reload()
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFile(null)
    setMergeStrategy('merge_best')
    setResult(null)
    setError(null)
    setLoading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
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
        if (!isOpen) {
          setTimeout(resetForm, 200)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import Candidates from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import candidates. Supports Apify leads-scraper-ppe format.
            Duplicates are automatically detected and handled.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-4">
            {/* File Drop Zone */}
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
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      Click to select a CSV file
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Max 50MB, .csv format
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Merge Strategy */}
            <div className="space-y-2">
              <Label htmlFor="mergeStrategy">Duplicate Handling</Label>
              <Select value={mergeStrategy} onValueChange={setMergeStrategy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="merge_best">Merge Best Data (Recommended)</SelectItem>
                  <SelectItem value="keep_existing">Keep Existing Records</SelectItem>
                  <SelectItem value="prefer_new">Prefer New Data</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {mergeStrategy === 'merge_best'
                  ? 'Combines the best data from both existing and new records.'
                  : mergeStrategy === 'keep_existing'
                    ? 'Skips candidates that already exist in your database.'
                    : 'Overwrites existing records with new CSV data.'}
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
                  Importing candidates... This may take a moment for large files.
                </div>
                <Progress value={50} className="h-2" />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleImport}
                disabled={loading || !file}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Candidates
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
                Successfully imported candidates from CSV!
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1 rounded-lg border p-3">
                <p className="text-muted-foreground">Total Rows</p>
                <p className="text-2xl font-bold">{result.totalRows}</p>
              </div>
              <div className="space-y-1 rounded-lg border p-3">
                <p className="text-muted-foreground">New Candidates</p>
                <p className="text-2xl font-bold text-green-600">{result.inserted}</p>
              </div>
              <div className="space-y-1 rounded-lg border p-3">
                <p className="text-muted-foreground">Updated</p>
                <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
              </div>
              <div className="space-y-1 rounded-lg border p-3">
                <p className="text-muted-foreground">Skipped</p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {result.duplicatesSkipped + result.skippedNoEmail}
                </p>
              </div>
            </div>

            <div className="space-y-1 rounded-lg border p-3 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Rows without email (skipped):</span>
                <span className="font-medium">{result.skippedNoEmail}</span>
              </div>
              <div className="flex justify-between">
                <span>Duplicates skipped:</span>
                <span className="font-medium">{result.duplicatesSkipped}</span>
              </div>
              {result.errors.length > 0 && (
                <div className="flex justify-between">
                  <span>Errors:</span>
                  <span className="font-medium text-red-600">{result.errors.length}</span>
                </div>
              )}
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
