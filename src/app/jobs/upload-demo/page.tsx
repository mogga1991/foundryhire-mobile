'use client'

import { useState } from 'react'
import { JobDocumentUpload } from '@/components/jobs/job-document-upload'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ParsedJobData {
  title?: string
  location?: string
  department?: string
  employmentType?: string
  experienceLevel?: string
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
}

export default function JobUploadDemoPage() {
  const router = useRouter()
  const [parsedData, setParsedData] = useState<ParsedJobData | null>(null)
  const [showUploader, setShowUploader] = useState(true)

  const handleParseComplete = (data: ParsedJobData) => {
    console.log('Parsed job data:', data)
    setParsedData(data)
    setShowUploader(false)
  }

  const handleCreateJob = async () => {
    if (!parsedData) return

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: parsedData.title,
          location: parsedData.location,
          department: parsedData.department,
          employment_type: parsedData.employmentType,
          experience_level: parsedData.experienceLevel,
          salary_min: parsedData.salaryMin,
          salary_max: parsedData.salaryMax,
          salary_currency: parsedData.salaryCurrency,
          description: parsedData.description,
          requirements: parsedData.requirements?.join('\n'),
          responsibilities: parsedData.responsibilities?.join('\n'),
          benefits: parsedData.benefits?.join('\n'),
          skills_required: parsedData.skillsRequired,
          skills_preferred: parsedData.skillsPreferred,
          status: 'draft',
        }),
      })

      const result = await response.json()

      if (result.data) {
        alert('Job created successfully!')
        router.push('/jobs')
      } else {
        alert('Failed to create job: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error creating job:', error)
      alert('Failed to create job. See console for details.')
    }
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Upload Job Description</h1>
          <p className="text-muted-foreground">
            Demo: Upload a document and AI will extract job details
          </p>
        </div>
      </div>

      {/* Uploader or Results */}
      {showUploader ? (
        <JobDocumentUpload
          onParseComplete={handleParseComplete}
          onCancel={() => router.back()}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Success! Review the Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <pre className="text-xs overflow-auto max-h-96">
                {JSON.stringify(parsedData, null, 2)}
              </pre>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploader(true)
                  setParsedData(null)
                }}
                className="flex-1"
              >
                Upload Another
              </Button>
              <Button
                onClick={handleCreateJob}
                className="flex-1"
              >
                Create Job from This Data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ol className="list-decimal list-inside space-y-2">
            <li>Upload a job description document (PDF, DOCX, DOC, or TXT)</li>
            <li>Wait for the AI to extract and parse the content (5-15 seconds)</li>
            <li>Review the extracted data for accuracy</li>
            <li>Click "Use This Data" to confirm or "Upload Different File" to try again</li>
            <li>Click "Create Job from This Data" to save to database</li>
          </ol>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
            <p className="font-semibold text-blue-900 dark:text-blue-100">Note:</p>
            <p className="text-blue-800 dark:text-blue-200">
              Make sure your ANTHROPIC_API_KEY is set in .env.local for AI parsing to work.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
