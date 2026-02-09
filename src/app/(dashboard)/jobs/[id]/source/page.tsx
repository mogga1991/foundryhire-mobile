'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import {
  SourcingProgress,
  type SourcingStatus,
} from '@/components/candidates/sourcing-progress'
import type { Job } from '@/lib/types'
import {
  Linkedin,
  Upload,
  Search,
  FileText,
  Loader2,
  ArrowLeft,
  Users,
  MapPin,
  CheckCircle,
  Plus,
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface SourcedCandidatePreview {
  id: string
  first_name: string
  last_name: string
  email: string | null
  current_title: string | null
  current_company: string | null
  location: string | null
  skills: string[]
  match_score: number
  source: string
  selected: boolean
}

interface CsvRow {
  first_name: string
  last_name: string
  email: string
  phone?: string
  current_title?: string
  current_company?: string
  location?: string
  linkedin_url?: string
  skills?: string
  experience_years?: string
}

// ============================================================================
// SourceCandidatesPage
// ============================================================================

export default function SourceCandidatesPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string

  const [job, setJob] = useState<Job | null>(null)
  const [jobLoading, setJobLoading] = useState(true)

  // LinkedIn sourcing state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLocation, setSearchLocation] = useState('')
  const [maxResults, setMaxResults] = useState('20')
  const [sourcingStatus, setSourcingStatus] = useState<SourcingStatus>('idle')
  const [sourcingCandidates, setSourcingCandidates] = useState<SourcedCandidatePreview[]>([])
  const [sourcingError, setSourcingError] = useState<string | undefined>()

  // CSV upload state
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvParsing, setCsvParsing] = useState(false)
  const [csvCandidates, setCsvCandidates] = useState<SourcedCandidatePreview[]>([])
  const [csvError, setCsvError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Adding to pipeline state
  const [addingToPipeline, setAddingToPipeline] = useState(false)

  // Fetch job details via API
  useEffect(() => {
    async function fetchJob() {
      try {
        const res = await fetch(`/api/jobs?id=${jobId}`)
        if (!res.ok) throw new Error('Failed to fetch job')
        const result = await res.json()
        const data = result.job

        setJob(data)

        // Pre-fill search query from job title
        if (data) {
          setSearchQuery(data.title)
          if (data.location) setSearchLocation(data.location)
        }
      } catch {
        // Handle error silently
      } finally {
        setJobLoading(false)
      }
    }

    fetchJob()
  }, [jobId])

  // ============================================================================
  // LinkedIn Sourcing
  // ============================================================================

  const handleStartSourcing = async () => {
    if (!searchQuery.trim()) return

    setSourcingStatus('in_progress')
    setSourcingCandidates([])
    setSourcingError(undefined)

    try {
      const response = await fetch('/api/sourcing/linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          searchQuery: searchQuery.trim(),
          location: searchLocation.trim() || undefined,
          maxResults: parseInt(maxResults) || 20,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Sourcing failed')
      }

      const data = await response.json()

      const candidates: SourcedCandidatePreview[] = (data.candidates || []).map(
        (c: Record<string, unknown>, index: number) => ({
          id: `sourced-${index}`,
          first_name: c.first_name as string,
          last_name: c.last_name as string,
          email: c.email as string | null,
          current_title: c.current_title as string | null,
          current_company: c.current_company as string | null,
          location: c.location as string | null,
          skills: (c.skills as string[]) || [],
          match_score: (c.match_score as number) || 0,
          source: 'linkedin',
          selected: true,
        })
      )

      setSourcingCandidates(candidates)
      setSourcingStatus('complete')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sourcing failed'
      setSourcingError(message)
      setSourcingStatus('error')
    }
  }

  const handleCancelSourcing = () => {
    setSourcingStatus('cancelled')
  }

  // ============================================================================
  // CSV Upload & Parse
  // ============================================================================

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'text/csv') {
      setCsvFile(file)
      parseCsvFile(file)
    } else {
      setCsvError('Please upload a CSV file.')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCsvFile(file)
      parseCsvFile(file)
    }
  }

  const parseCsvFile = useCallback(async (file: File) => {
    setCsvParsing(true)
    setCsvError(null)
    setCsvCandidates([])

    try {
      const text = await file.text()
      const lines = text.split('\n').filter((line) => line.trim())

      if (lines.length < 2) {
        throw new Error('CSV file must have a header row and at least one data row.')
      }

      // Parse header
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''))

      // Validate required columns
      const requiredColumns = ['first_name', 'last_name', 'email']
      const missingColumns = requiredColumns.filter((col) => !headers.includes(col))
      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`)
      }

      // Parse data rows
      const candidates: SourcedCandidatePreview[] = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.trim().replace(/['"]/g, ''))
        const row: Record<string, string> = {}

        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })

        const csvRow = row as unknown as CsvRow

        if (csvRow.first_name && csvRow.last_name && csvRow.email) {
          candidates.push({
            id: `csv-${i}`,
            first_name: csvRow.first_name,
            last_name: csvRow.last_name,
            email: csvRow.email,
            current_title: csvRow.current_title || null,
            current_company: csvRow.current_company || null,
            location: csvRow.location || null,
            skills: csvRow.skills
              ? csvRow.skills.split(';').map((s) => s.trim())
              : [],
            match_score: 0,
            source: 'csv',
            selected: true,
          })
        }
      }

      if (candidates.length === 0) {
        throw new Error('No valid candidate rows found in the CSV file.')
      }

      setCsvCandidates(candidates)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse CSV file'
      setCsvError(message)
    } finally {
      setCsvParsing(false)
    }
  }, [])

  // ============================================================================
  // Add to Pipeline
  // ============================================================================

  const handleToggleCandidate = (id: string, list: 'sourcing' | 'csv') => {
    if (list === 'sourcing') {
      setSourcingCandidates((prev) =>
        prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
      )
    } else {
      setCsvCandidates((prev) =>
        prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
      )
    }
  }

  const handleAddToPipeline = async (candidates: SourcedCandidatePreview[]) => {
    const selected = candidates.filter((c) => c.selected)
    if (selected.length === 0) return

    setAddingToPipeline(true)

    try {
      if (!job) throw new Error('Job not found')

      // Insert candidates via the API
      const promises = selected.map((c) =>
        fetch('/api/candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: job.companyId,
            job_id: jobId,
            first_name: c.first_name,
            last_name: c.last_name,
            email: c.email || null,
            current_title: c.current_title,
            current_company: c.current_company,
            location: c.location,
            skills: c.skills,
            ai_score: c.match_score > 0 ? c.match_score : null,
            source: c.source,
            status: 'new',
            stage: 'sourced',
          }),
        })
      )

      await Promise.all(promises)

      // Redirect to candidates page
      router.push(`/jobs/${jobId}/candidates`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add candidates'
      alert(message)
    } finally {
      setAddingToPipeline(false)
    }
  }

  // ============================================================================
  // Render
  // ============================================================================

  if (jobLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const selectedSourcingCount = sourcingCandidates.filter((c) => c.selected).length
  const selectedCsvCount = csvCandidates.filter((c) => c.selected).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => router.push(`/jobs/${jobId}/candidates`)}
        >
          <ArrowLeft className="size-4" />
          Back to Candidates
        </Button>

        <h1 className="text-2xl font-bold tracking-tight">Source Candidates</h1>
        {job && (
          <p className="text-muted-foreground mt-1">
            Find and import candidates for {job.title}
          </p>
        )}
      </div>

      {/* Sourcing Options Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Option A: LinkedIn Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Linkedin className="size-5 text-blue-600" />
              LinkedIn Search
            </CardTitle>
            <CardDescription>
              Search for candidates matching your job requirements on LinkedIn.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search-query">Search Query</Label>
              <Input
                id="search-query"
                placeholder="e.g., Senior Project Manager Construction"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="search-location">Location</Label>
              <Input
                id="search-location"
                placeholder="e.g., Houston, TX"
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-results">Max Results</Label>
              <Input
                id="max-results"
                type="number"
                min="5"
                max="100"
                value={maxResults}
                onChange={(e) => setMaxResults(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleStartSourcing}
              disabled={
                !searchQuery.trim() || sourcingStatus === 'in_progress'
              }
            >
              {sourcingStatus === 'in_progress' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Start Sourcing
            </Button>
          </CardContent>
        </Card>

        {/* Option B: CSV Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5 text-emerald-600" />
              CSV Upload
            </CardTitle>
            <CardDescription>
              Import candidates from a CSV file. Required columns: first_name, last_name, email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drag & Drop Area */}
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                ${
                  isDragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50'
                }
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">
                {csvFile ? csvFile.name : 'Drop your CSV file here'}
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse files
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />

            {csvError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-900">
                {csvError}
              </div>
            )}

            {csvParsing && (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-sm text-muted-foreground">
                  Parsing CSV...
                </span>
              </div>
            )}

            {csvCandidates.length > 0 && (
              <Button
                className="w-full"
                variant="outline"
                onClick={() => handleAddToPipeline(csvCandidates)}
                disabled={addingToPipeline || selectedCsvCount === 0}
              >
                {addingToPipeline ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Import & Score ({selectedCsvCount} selected)
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sourcing Progress */}
      {sourcingStatus !== 'idle' && (
        <SourcingProgress
          status={sourcingStatus}
          candidatesFound={sourcingCandidates.length}
          totalExpected={parseInt(maxResults) || 20}
          estimatedTimeRemaining={sourcingStatus === 'in_progress' ? 15 : undefined}
          errorMessage={sourcingError}
          onCancel={handleCancelSourcing}
        />
      )}

      {/* LinkedIn Results Preview */}
      {sourcingCandidates.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="size-4" />
                Sourced Candidates ({sourcingCandidates.length})
              </CardTitle>
              <Button
                onClick={() => handleAddToPipeline(sourcingCandidates)}
                disabled={addingToPipeline || selectedSourcingCount === 0}
              >
                {addingToPipeline ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Add to Pipeline ({selectedSourcingCount})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sourcingCandidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={candidate.selected}
                    onCheckedChange={() =>
                      handleToggleCandidate(candidate.id, 'sourcing')
                    }
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {candidate.first_name} {candidate.last_name}
                      </span>
                      {candidate.match_score > 0 && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            candidate.match_score >= 80
                              ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400'
                              : candidate.match_score >= 60
                              ? 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400'
                              : 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400'
                          }`}
                        >
                          {candidate.match_score}% match
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {candidate.current_title}
                      {candidate.current_title && candidate.current_company && ' at '}
                      {candidate.current_company}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {candidate.location && (
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-0.5">
                          <MapPin className="size-3" />
                          {candidate.location}
                        </span>
                      )}
                      {candidate.skills.slice(0, 3).map((skill) => (
                        <Badge
                          key={skill}
                          variant="secondary"
                          className="text-[10px] py-0"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CSV Results Preview */}
      {csvCandidates.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="size-4" />
                CSV Candidates ({csvCandidates.length})
              </CardTitle>
              <Button
                onClick={() => handleAddToPipeline(csvCandidates)}
                disabled={addingToPipeline || selectedCsvCount === 0}
              >
                {addingToPipeline ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Add to Pipeline ({selectedCsvCount})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {csvCandidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={candidate.selected}
                    onCheckedChange={() =>
                      handleToggleCandidate(candidate.id, 'csv')
                    }
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {candidate.first_name} {candidate.last_name}
                      </span>
                      <CheckCircle className="size-3.5 text-emerald-500" />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {candidate.email || 'No email'}
                      {candidate.current_title && ` - ${candidate.current_title}`}
                      {candidate.current_company && ` at ${candidate.current_company}`}
                    </p>
                    {candidate.skills.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        {candidate.skills.slice(0, 4).map((skill) => (
                          <Badge
                            key={skill}
                            variant="secondary"
                            className="text-[10px] py-0"
                          >
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
