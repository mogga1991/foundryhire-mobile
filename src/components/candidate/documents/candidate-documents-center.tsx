'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Trash2, Upload, FileText, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface CandidateDocument {
  id: string
  documentType: string
  fileName: string
  fileUrl: string
  score: number | null
  status: string
  insights: { notes?: string[] } | null
  createdAt: string
}

interface RequiredItem {
  type: string
  label: string
  required: boolean
}

export function CandidateDocumentsCenter() {
  const [documents, setDocuments] = useState<CandidateDocument[]>([])
  const [requiredChecklist, setRequiredChecklist] = useState<RequiredItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedType, setSelectedType] = useState('resume')
  const [file, setFile] = useState<File | null>(null)

  const uploadedTypes = useMemo(() => new Set(documents.map((doc) => doc.documentType)), [documents])

  useEffect(() => {
    void loadDocuments()
  }, [])

  async function loadDocuments() {
    setLoading(true)
    try {
      const res = await fetch('/api/candidate/documents')
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to load documents')
      }
      setDocuments(payload.documents ?? [])
      setRequiredChecklist(payload.requiredChecklist ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  async function uploadDocument() {
    if (!file) {
      toast.error('Select a file first')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentType', selectedType)
      formData.append('required', requiredChecklist.some((item) => item.type === selectedType && item.required) ? 'true' : 'false')

      const res = await fetch('/api/candidate/documents', {
        method: 'POST',
        body: formData,
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to upload document')
      }

      setDocuments((prev) => [payload.document, ...prev])
      setFile(null)
      toast.success('Document uploaded')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  async function deleteDocument(documentId: string) {
    try {
      const res = await fetch(`/api/candidate/documents?id=${documentId}`, { method: 'DELETE' })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to delete document')
      }

      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId))
      toast.success('Document removed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete document')
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="text-orange-900">Required Checklist</CardTitle>
          <CardDescription>Submit these files to speed up evaluation.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {requiredChecklist.map((item) => {
            const uploaded = uploadedTypes.has(item.type)
            return (
              <div key={item.type} className="rounded-lg border border-orange-200 bg-orange-50 p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.required ? 'Required' : 'Optional'}</p>
                </div>
                {uploaded ? (
                  <Badge className="bg-green-600 hover:bg-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Uploaded
                  </Badge>
                ) : (
                  <Badge variant="secondary">Pending</Badge>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="text-orange-900">Upload Document</CardTitle>
          <CardDescription>Accepted types: PDF, DOC, DOCX, PNG, JPG (max 8MB).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger>
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="resume">Resume</SelectItem>
              <SelectItem value="work_auth">Work Authorization</SelectItem>
              <SelectItem value="license">License</SelectItem>
              <SelectItem value="certification">Certification</SelectItem>
              <SelectItem value="portfolio">Portfolio</SelectItem>
              <SelectItem value="additional">Additional</SelectItem>
            </SelectContent>
          </Select>

          <input
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="block w-full text-sm"
          />

          <Button onClick={uploadDocument} disabled={uploading || !file} className="bg-orange-600 hover:bg-orange-700">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Upload
          </Button>
        </CardContent>
      </Card>

      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="text-orange-900">Uploaded Files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && (
            <div className="text-sm text-gray-600">Loading documents...</div>
          )}

          {!loading && documents.length === 0 && (
            <div className="text-sm text-gray-600">No documents uploaded yet.</div>
          )}

          {documents.map((doc) => (
            <div key={doc.id} className="rounded-lg border border-orange-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 inline-flex items-center gap-1">
                    <FileText className="h-4 w-4 text-orange-700" />
                    {doc.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize mt-1">
                    {doc.documentType.replace('_', ' ')} • {doc.status.replace('_', ' ')}
                  </p>
                  {doc.score !== null && (
                    <p className="text-xs text-muted-foreground mt-1">Score: {doc.score}</p>
                  )}
                  {Array.isArray(doc.insights?.notes) && doc.insights?.notes?.[0] && (
                    <p className="text-xs text-muted-foreground mt-1">{doc.insights.notes[0]}</p>
                  )}
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-orange-700 hover:text-orange-800 mt-2 inline-block">
                    Open file
                  </a>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void deleteDocument(doc.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
