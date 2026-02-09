'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles, FileUp, Edit3, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { JobForm } from './job-form'
import { JobDocumentUploader } from './job-document-uploader'

interface CreateJobDialogProps {
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CreateJobDialog({ trigger, open, onOpenChange }: CreateJobDialogProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('manual')
  const [autoGenerateLeads, setAutoGenerateLeads] = useState(true)
  const [isParsing, setIsParsing] = useState(false)
  const [parsedData, setParsedData] = useState<any>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen)
    } else {
      setIsOpen(newOpen)
    }

    // Reset state when dialog closes
    if (!newOpen) {
      setActiveTab('manual')
      setAutoGenerateLeads(true)
      setParsedData(null)
      setParseError(null)
      setIsParsing(false)
    }
  }

  const handleDocumentUploadComplete = async (text: string, url: string) => {
    setIsParsing(true)
    setParseError(null)

    try {
      // Parse the job description using AI
      const response = await fetch('/api/ai/parse-job-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, documentUrl: url }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to parse job description')
      }

      // Extract the parsed data
      const { data } = result

      // Transform parsed data to match JobForm expected structure
      const formData = {
        title: data.title || '',
        location: data.location || '',
        department: data.department || data.industry_sector || '',
        employment_type: data.employment_type || 'Full-time',
        experience_level: data.experience_level || '',
        salary_min: data.salary_min || undefined,
        salary_max: data.salary_max || undefined,
        salary_currency: data.salary_currency || 'USD',
        skills_required: data.skills_required || [],
        skills_preferred: data.skills_preferred || [],
        description: data.description || text,
      }

      setParsedData({
        formData,
        confidence: data.confidence,
        missingFields: data.missingFields || [],
      })

      // Switch to manual tab to show parsed data
      setActiveTab('manual')

      toast.success('Document parsed successfully', {
        description: `AI extracted job details with ${Math.round(data.confidence.overall)}% confidence`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to parse document'
      setParseError(message)
      toast.error('Parsing failed', {
        description: message,
      })
    } finally {
      setIsParsing(false)
    }
  }

  const handleDocumentUploadError = (error: string) => {
    setParseError(error)
    toast.error('Upload failed', {
      description: error,
    })
  }

  const controlledOpen = open !== undefined ? open : isOpen
  const controlledOnOpenChange = onOpenChange || handleOpenChange

  return (
    <Dialog open={controlledOpen} onOpenChange={controlledOnOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="lg" className="w-full sm:w-auto">
            <Plus className="size-4" />
            Create New Job
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Job</DialogTitle>
          <DialogDescription>
            Create a job posting manually or upload a document to auto-fill details with AI
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual" className="gap-2">
              <Edit3 className="size-4" />
              Manual Entry
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-2" disabled={isParsing}>
              <FileUp className="size-4" />
              Upload Document
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="mt-6 space-y-6">
            {parsedData && (
              <Alert className="border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/20">
                <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <AlertDescription className="text-purple-900 dark:text-purple-100">
                  <span className="font-medium">
                    AI has pre-filled {Object.keys(parsedData.formData).filter(key => {
                      const val = parsedData.formData[key]
                      return val !== undefined && val !== null && val !== '' && (!Array.isArray(val) || val.length > 0)
                    }).length} fields with {Math.round(parsedData.confidence.overall)}% confidence.
                  </span>
                  {parsedData.missingFields.length > 0 && (
                    <span className="block mt-1 text-sm text-purple-700 dark:text-purple-300">
                      Missing fields: {parsedData.missingFields.join(', ')}
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Auto-generate leads checkbox */}
            <div className="flex items-center space-x-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <Checkbox
                id="auto-generate-leads"
                checked={autoGenerateLeads}
                onCheckedChange={(checked) => setAutoGenerateLeads(checked === true)}
              />
              <div className="flex-1">
                <Label
                  htmlFor="auto-generate-leads"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Auto-Generate Leads (Recommended)
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Automatically generate 20-50 qualified candidate leads using free-tier APIs after creating this job
                </p>
              </div>
            </div>

            <JobForm
              initialData={parsedData?.formData}
              aiAssisted={!!parsedData}
              confidenceScores={parsedData?.confidence}
              autoGenerateLeads={autoGenerateLeads}
              onSuccess={(jobId) => {
                controlledOnOpenChange(false)
                router.push(`/jobs/${jobId}`)
              }}
            />
          </TabsContent>

          <TabsContent value="upload" className="mt-6">
            {isParsing ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">Parsing your document...</p>
                  <p className="text-sm text-muted-foreground">
                    AI is extracting job details from your document
                  </p>
                </div>
              </div>
            ) : parseError ? (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            ) : null}

            {!isParsing && (
              <JobDocumentUploader
                onUploadComplete={handleDocumentUploadComplete}
                onError={handleDocumentUploadError}
                onCancel={() => setActiveTab('manual')}
              />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
