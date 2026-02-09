'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileText, Loader2, ExternalLink } from 'lucide-react'

interface ResumeViewerProps {
  candidateId: string
  resumeUrl: string | null
  resumeText: string | null
  onUploadComplete: (url: string) => void
}

export function ResumeViewer({
  candidateId,
  resumeUrl,
  resumeText,
  onUploadComplete,
}: ResumeViewerProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Only PDF and DOCX files are accepted.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size must be under 10MB.')
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('candidateId', candidateId)

      const res = await fetch('/api/upload/resume', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to upload resume')
      }

      const data = await res.json()
      onUploadComplete(data.url)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload resume'
      setUploadError(message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4" />
            Resume
          </CardTitle>
          <div className="flex items-center gap-2">
            {resumeUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={resumeUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                  Open
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleUploadClick}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {uploading ? 'Uploading...' : 'Upload Resume'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={handleFileChange}
        />

        {uploadError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-900">
            {uploadError}
          </div>
        )}

        {resumeUrl && (
          <div className="mb-4">
            <iframe
              src={resumeUrl}
              className="w-full h-[500px] rounded-lg border"
              title="Resume PDF Viewer"
            />
          </div>
        )}

        {resumeText && (
          <div className="space-y-2">
            {!resumeUrl && (
              <h4 className="text-sm font-medium text-muted-foreground">
                Parsed Resume Text
              </h4>
            )}
            <div className="bg-muted/50 rounded-lg p-4 max-h-[400px] overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                {resumeText}
              </pre>
            </div>
          </div>
        )}

        {!resumeUrl && !resumeText && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <FileText className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium mb-1">No resume uploaded</p>
            <p className="text-xs text-muted-foreground mb-4">
              Upload a PDF or DOCX file to view and analyze the candidate&apos;s resume.
            </p>
            <Button variant="outline" size="sm" onClick={handleUploadClick}>
              <Upload className="size-3.5" />
              Upload Resume
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
