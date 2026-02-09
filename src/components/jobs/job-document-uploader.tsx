'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, X, Loader2, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

interface JobDocumentUploaderProps {
  onUploadComplete: (text: string, url: string) => void
  onError: (error: string) => void
  onCancel?: () => void
}

export function JobDocumentUploader({
  onUploadComplete,
  onError,
  onCancel,
}: JobDocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX only
  ]

  const validateFile = (file: File): boolean => {
    if (!allowedTypes.includes(file.type)) {
      onError('Only DOCX files are accepted. Please convert .doc files to .docx format.')
      return false
    }

    if (file.size > 10 * 1024 * 1024) {
      onError('File size must be under 10MB')
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
        }
      }
    },
    [onError]
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      if (validateFile(file)) {
        setSelectedFile(file)
      }
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    setUploadProgress(10)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      setUploadProgress(30)

      const response = await fetch('/api/upload/job-description', {
        method: 'POST',
        body: formData,
      })

      setUploadProgress(60)

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Upload failed')
      }

      setUploadProgress(100)

      // Always use the extracted text from the document
      if (!data.text || data.text.trim().length < 50) {
        throw new Error('Could not extract text from document. Please ensure the document contains text.')
      }

      onUploadComplete(data.text, data.url)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      onError(message)
      setSelectedFile(null)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Upload Job Description</h3>
            <p className="text-sm text-muted-foreground">
              Upload a document and AI will extract the job details
            </p>
          </div>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Upload Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'relative cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50',
            selectedFile && 'border-green-500 bg-green-50 dark:bg-green-950/20'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileSelect}
            className="hidden"
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
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedFile(null)
                }}
              >
                Remove
              </Button>
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
                Supported: DOCX only • Max size: 10MB
              </div>
            </div>
          )}
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Uploading document...</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}

        {/* Tips */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Tips for better results:</strong>
            <ul className="mt-2 space-y-1 text-sm">
              <li>• Include salary range for accurate parsing</li>
              <li>• List required and preferred skills separately</li>
              <li>• Mention experience level clearly</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Action Buttons */}
        <div className="flex justify-end">
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            size="lg"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading & Parsing...
              </>
            ) : (
              'Upload & Parse Document'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
