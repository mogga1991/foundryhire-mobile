'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, X, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface ParsedJobData {
  title?: string
  location?: string
  department?: string
  employmentType?: 'full-time' | 'part-time' | 'contract' | 'temporary' | 'internship'
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'lead' | 'executive'
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
  skillsRequired?: string[]
  skillsPreferred?: string[]
  description?: string
  requirements?: string[]
  responsibilities?: string[]
  benefits?: string[]
  confidence: {
    overall: number
    fields: Record<string, number>
  }
  missingFields: string[]
  fileUrl?: string
  fileName?: string
  extractedText?: string
}

interface JobDocumentUploadProps {
  onParseComplete: (data: ParsedJobData) => void
  onCancel?: () => void
}

type UploadStage = 'idle' | 'uploading' | 'extracting' | 'parsing' | 'complete' | 'error'

export function JobDocumentUpload({ onParseComplete, onCancel }: JobDocumentUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [stage, setStage] = useState<UploadStage>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [parsedData, setParsedData] = useState<ParsedJobData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
  ]

  const validateFile = (file: File): boolean => {
    setError(null)

    if (!allowedTypes.includes(file.type)) {
      setError('Only PDF, DOC, DOCX, and TXT files are accepted')
      return false
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB')
      return false
    }

    return true
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = e.dataTransfer.files
      if (files.length > 0) {
        const file = files[0]
        if (validateFile(file)) {
          setSelectedFile(file)
          setError(null)
        }
      }
    },
    []
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      if (validateFile(file)) {
        setSelectedFile(file)
        setError(null)
      }
    }
  }

  const handleUploadAndParse = async () => {
    if (!selectedFile) return

    setStage('uploading')
    setProgress(10)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      setProgress(30)
      setStage('extracting')

      const response = await fetch('/api/jobs/parse', {
        method: 'POST',
        body: formData,
      })

      setProgress(60)
      setStage('parsing')

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload and parsing failed')
      }

      setProgress(100)
      setStage('complete')

      // Store parsed data for review
      setParsedData(result.data)

    } catch (err) {
      setStage('error')
      const message = err instanceof Error ? err.message : 'Upload and parsing failed'
      setError(message)
      setProgress(0)
    }
  }

  const handleConfirmParsedData = () => {
    if (parsedData) {
      onParseComplete(parsedData)
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setStage('idle')
    setProgress(0)
    setError(null)
    setParsedData(null)
  }

  // Render parsed data review
  if (stage === 'complete' && parsedData) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Parsing Complete
            </CardTitle>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Confidence Score */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>AI Confidence Score: {parsedData.confidence.overall}%</AlertTitle>
            <AlertDescription>
              Please review the extracted information below and make any necessary corrections.
            </AlertDescription>
          </Alert>

          {/* Extracted Fields */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Extracted Job Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {parsedData.title && (
                  <div>
                    <span className="text-muted-foreground">Title:</span>{' '}
                    <span className="font-medium">{parsedData.title}</span>
                  </div>
                )}
                {parsedData.location && (
                  <div>
                    <span className="text-muted-foreground">Location:</span>{' '}
                    <span className="font-medium">{parsedData.location}</span>
                  </div>
                )}
                {parsedData.department && (
                  <div>
                    <span className="text-muted-foreground">Department:</span>{' '}
                    <span className="font-medium">{parsedData.department}</span>
                  </div>
                )}
                {parsedData.employmentType && (
                  <div>
                    <span className="text-muted-foreground">Type:</span>{' '}
                    <span className="font-medium capitalize">{parsedData.employmentType}</span>
                  </div>
                )}
                {parsedData.experienceLevel && (
                  <div>
                    <span className="text-muted-foreground">Level:</span>{' '}
                    <span className="font-medium capitalize">{parsedData.experienceLevel}</span>
                  </div>
                )}
                {parsedData.salaryMin && parsedData.salaryMax && (
                  <div>
                    <span className="text-muted-foreground">Salary:</span>{' '}
                    <span className="font-medium">
                      {parsedData.salaryCurrency || 'USD'} {parsedData.salaryMin.toLocaleString()} - {parsedData.salaryMax.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Skills */}
            {parsedData.skillsRequired && parsedData.skillsRequired.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Required Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {parsedData.skillsRequired.map((skill, idx) => (
                    <Badge key={idx} variant="default">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {parsedData.skillsPreferred && parsedData.skillsPreferred.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Preferred Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {parsedData.skillsPreferred.map((skill, idx) => (
                    <Badge key={idx} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Requirements */}
            {parsedData.requirements && parsedData.requirements.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Requirements</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {parsedData.requirements.slice(0, 5).map((req, idx) => (
                    <li key={idx}>{req}</li>
                  ))}
                  {parsedData.requirements.length > 5 && (
                    <li className="text-xs italic">...and {parsedData.requirements.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            {/* Responsibilities */}
            {parsedData.responsibilities && parsedData.responsibilities.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Responsibilities</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {parsedData.responsibilities.slice(0, 5).map((resp, idx) => (
                    <li key={idx}>{resp}</li>
                  ))}
                  {parsedData.responsibilities.length > 5 && (
                    <li className="text-xs italic">...and {parsedData.responsibilities.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            {/* Missing Fields Warning */}
            {parsedData.missingFields.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Missing Information</AlertTitle>
                <AlertDescription>
                  The following fields could not be extracted: {parsedData.missingFields.join(', ')}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              Upload Different File
            </Button>
            <Button onClick={handleConfirmParsedData} className="flex-1">
              Use This Data
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Render upload interface
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Upload Job Description</CardTitle>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Upload Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !selectedFile && fileInputRef.current?.click()}
          className={cn(
            'relative cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-all',
            isDragging
              ? 'border-primary bg-primary/5 scale-[1.02]'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50',
            selectedFile && 'border-green-500 bg-green-50 dark:bg-green-950/20',
            (stage === 'uploading' || stage === 'extracting' || stage === 'parsing') && 'pointer-events-none opacity-60'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileSelect}
            className="hidden"
            disabled={stage !== 'idle' && stage !== 'error'}
          />

          {selectedFile ? (
            <div className="space-y-3">
              <FileText className="mx-auto h-12 w-12 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium text-green-900 dark:text-green-100">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              {stage === 'idle' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedFile(null)
                    setError(null)
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <div>
                <p className="text-base font-medium">
                  Drag and drop your job description here
                </p>
                <p className="text-sm text-muted-foreground">or click to browse</p>
              </div>
              <div className="text-xs text-muted-foreground">
                Supported: PDF, DOC, DOCX, TXT • Max size: 10MB
              </div>
            </div>
          )}
        </div>

        {/* Progress Indicator */}
        {(stage === 'uploading' || stage === 'extracting' || stage === 'parsing') && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                {stage === 'uploading' && 'Uploading document...'}
                {stage === 'extracting' && 'Extracting text...'}
                {stage === 'parsing' && 'Parsing with AI...'}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Error Display */}
        {error && stage === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Upload Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Tips */}
        {stage === 'idle' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Tips for Better Results</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 space-y-1 text-sm">
                <li>• Include salary range for accurate parsing</li>
                <li>• List required and preferred skills separately</li>
                <li>• Clearly mention experience level and job type</li>
                <li>• Use clear section headers (Requirements, Responsibilities, etc.)</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Action Button */}
        {stage === 'idle' && (
          <Button
            onClick={handleUploadAndParse}
            disabled={!selectedFile}
            className="w-full"
            size="lg"
          >
            Upload & Parse with AI
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
