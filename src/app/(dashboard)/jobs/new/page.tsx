'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { JobForm } from '@/components/jobs/job-form'
import { JobCreationChoice } from '@/components/jobs/job-creation-choice'
import { JobDocumentUploader } from '@/components/jobs/job-document-uploader'
import { AIParsingLoader } from '@/components/jobs/ai-parsing-loader'
import { useParseJob } from '@/hooks/use-parse-job'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import type { ParseJobDescriptionResult } from '@/lib/ai/prompts/parse-job-description'

type CreationMode = 'choice' | 'manual' | 'ai' | 'ai-parsing' | 'ai-review'

export default function NewJobPage() {
  const searchParams = useSearchParams()
  const initialMode = searchParams.get('mode') as CreationMode | null
  const [mode, setMode] = useState<CreationMode>(initialMode || 'choice')
  const [parsedData, setParsedData] = useState<ParseJobDescriptionResult | null>(null)
  const [documentUrl, setDocumentUrl] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const { parseJob, parsing } = useParseJob()

  const handleSelectManual = () => {
    setMode('manual')
  }

  const handleSelectAI = () => {
    setMode('ai')
  }

  const handleUploadComplete = async (text: string, url: string) => {
    setDocumentUrl(url)
    setError(null)
    setMode('ai-parsing')

    try {
      const result = await parseJob(text, url)
      if (result) {
        setParsedData(result)
        setMode('ai-review')
      } else {
        setError('Failed to parse job description. Please try again or continue manually.')
        setMode('ai')
      }
    } catch (err) {
      setError('An error occurred during parsing. Please try again or continue manually.')
      setMode('ai')
    }
  }

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage)
  }

  const handleBackToChoice = () => {
    setMode('choice')
    setParsedData(null)
    setDocumentUrl('')
    setError(null)
  }

  const handleBackToUpload = () => {
    setMode('ai')
    setParsedData(null)
    setError(null)
  }

  // Show choice screen
  if (mode === 'choice') {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-4">
          <Link href="/jobs">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
              <span className="sr-only">Back to Jobs</span>
            </Button>
          </Link>
        </div>

        <JobCreationChoice onSelectManual={handleSelectManual} onSelectAI={handleSelectAI} />
      </div>
    )
  }

  // Show AI upload screen
  if (mode === 'ai') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBackToChoice}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              AI-Powered Job Creation
            </h1>
            <p className="text-muted-foreground text-sm">
              Upload a job description and let AI extract the details
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <JobDocumentUploader
          onUploadComplete={handleUploadComplete}
          onError={handleUploadError}
          onCancel={handleBackToChoice}
        />
      </div>
    )
  }

  // Show parsing loader
  if (mode === 'ai-parsing') {
    return (
      <div className="max-w-3xl mx-auto">
        <AIParsingLoader />
      </div>
    )
  }

  // Show manual form or AI review form
  const isAIReview = mode === 'ai-review'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={isAIReview ? handleBackToUpload : handleBackToChoice}
        >
          <ArrowLeft className="size-4" />
          <span className="sr-only">Back</span>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isAIReview ? 'Review & Complete Job Details' : 'Create New Job'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isAIReview
              ? 'Review AI-extracted information and complete any missing fields'
              : 'Fill in the details to create a new job posting.'}
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Job Form */}
      <JobForm
        initialData={parsedData || undefined}
        aiAssisted={isAIReview}
        confidenceScores={parsedData?.confidence}
      />
    </div>
  )
}
