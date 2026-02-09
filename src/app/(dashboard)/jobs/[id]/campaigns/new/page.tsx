'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CampaignWizard } from '@/components/campaigns/campaign-wizard'
import { EmailEditor } from '@/components/campaigns/email-editor'
import { useJob } from '@/hooks/use-jobs'
import { useCreateCampaign } from '@/hooks/use-campaigns'
import { useGenerateEmail } from '@/hooks/use-campaigns'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Users,
  Check,
  Calendar,
  Plus,
  Trash2,
  Send,
  Mail,
} from 'lucide-react'
import type { Candidate } from '@/lib/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface NewCampaignPageProps {
  params: Promise<{ id: string }>
}

const WIZARD_STEPS = [
  { id: 1, title: 'Select Candidates', description: 'Choose recipients' },
  { id: 2, title: 'Generate Email', description: 'Compose outreach' },
  { id: 3, title: 'Follow-ups', description: 'Set sequence' },
  { id: 4, title: 'Review & Launch', description: 'Confirm details' },
]

const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  subject: z.string().min(1, 'Subject line is required'),
  body: z.string().min(1, 'Email body is required'),
})

type CampaignFormData = z.infer<typeof campaignSchema>

interface FollowUp {
  id: string
  delayDays: number
  subject: string
  body: string
}

export default function NewCampaignPage({ params }: NewCampaignPageProps) {
  const { id: jobId } = use(params)
  const router = useRouter()
  const { data: job } = useJob(jobId)
  const { createCampaign, loading: creating } = useCreateCampaign()
  const { generateEmail, loading: generating } = useGenerateEmail()

  const [currentStep, setCurrentStep] = useState(1)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(true)
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [savingDraft, setSavingDraft] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CampaignFormData>({
    defaultValues: {
      name: '',
      subject: '',
      body: '',
    },
  })

  const subject = watch('subject')
  const body = watch('body')
  const campaignName = watch('name')

  // Fetch candidates for this job via API
  const fetchCandidates = useCallback(async () => {
    setLoadingCandidates(true)
    try {
      const searchParams = new URLSearchParams({
        jobId,
        sortField: 'created_at',
        sortOrder: 'desc',
        perPage: '1000',
      })

      if (statusFilter && statusFilter !== 'all') {
        searchParams.set('status', statusFilter)
      }

      const res = await fetch(`/api/candidates?${searchParams.toString()}`)
      if (!res.ok) {
        console.error('Failed to fetch candidates')
      } else {
        const data = await res.json()
        setCandidates(data.candidates ?? [])
      }
    } finally {
      setLoadingCandidates(false)
    }
  }, [jobId, statusFilter])

  useEffect(() => {
    fetchCandidates()
  }, [fetchCandidates])

  // Selection handlers
  const toggleCandidate = (candidateId: string) => {
    setSelectedCandidateIds((prev) => {
      const next = new Set(prev)
      if (next.has(candidateId)) {
        next.delete(candidateId)
      } else {
        next.add(candidateId)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedCandidateIds(new Set(candidates.map((c) => c.id)))
  }

  const selectNone = () => {
    setSelectedCandidateIds(new Set())
  }

  // Follow-up handlers
  const addFollowUp = () => {
    if (followUps.length >= 3) return
    setFollowUps((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        delayDays: prev.length === 0 ? 3 : prev.length === 1 ? 5 : 7,
        subject: '',
        body: '',
      },
    ])
  }

  const removeFollowUp = (id: string) => {
    setFollowUps((prev) => prev.filter((f) => f.id !== id))
  }

  const updateFollowUp = (id: string, field: keyof FollowUp, value: string | number) => {
    setFollowUps((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    )
  }

  // AI email generation
  const handleGenerateEmail = async () => {
    if (!job) return

    const result = await generateEmail({
      jobId,
      jobTitle: job.title,
      jobDescription: job.description || undefined,
      companyName: undefined,
      tone: 'professional',
    })

    if (result) {
      setValue('subject', result.subject)
      setValue('body', result.body)
    }
  }

  // Step navigation
  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 1:
        return selectedCandidateIds.size > 0
      case 2:
        return subject.trim().length > 0 && body.trim().length > 0
      case 3:
        return true
      default:
        return false
    }
  }

  const goNext = () => {
    if (currentStep < 4 && canGoNext()) {
      setCurrentStep(currentStep + 1)
    }
  }

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Submit handlers
  const handleSaveDraft = async () => {
    if (!campaignName.trim()) {
      alert('Please enter a campaign name.')
      return
    }

    setSavingDraft(true)
    try {
      const campaign = await createCampaign({
        name: campaignName || `Campaign for ${job?.title || 'job'}`,
        subject,
        body,
        jobId,
        candidateIds: Array.from(selectedCandidateIds),
        followUps: followUps.map((f) => ({
          delayDays: f.delayDays,
          subject: f.subject,
          body: f.body,
        })),
      })

      if (campaign) {
        router.push(`/jobs/${jobId}/campaigns/${campaign.id}`)
      }
    } finally {
      setSavingDraft(false)
    }
  }

  const handleLaunchCampaign = async () => {
    if (!campaignName.trim()) {
      alert('Please enter a campaign name.')
      return
    }

    const campaign = await createCampaign({
      name: campaignName || `Campaign for ${job?.title || 'job'}`,
      subject,
      body,
      jobId,
      candidateIds: Array.from(selectedCandidateIds),
      followUps: followUps.map((f) => ({
        delayDays: f.delayDays,
        subject: f.subject,
        body: f.body,
      })),
    })

    if (campaign) {
      // Launch the campaign after creation
      try {
        await fetch(`/api/campaigns/${campaign.id}/send`, { method: 'POST' })
      } catch {
        // Campaign was created, navigate anyway
      }
      router.push(`/jobs/${jobId}/campaigns/${campaign.id}`)
    }
  }

  // Selected candidates list for display
  const selectedCandidates = candidates.filter((c) => selectedCandidateIds.has(c.id))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/jobs/${jobId}/campaigns`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Campaign</h1>
          {job && (
            <p className="text-sm text-muted-foreground">
              New outreach campaign for {job.title}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="campaign-name">Campaign Name</Label>
        <Input
          id="campaign-name"
          placeholder="e.g., Senior Engineer Outreach - January 2026"
          {...register('name')}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <CampaignWizard steps={WIZARD_STEPS} currentStep={currentStep}>
        {/* Step 1: Select Candidates */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Select Candidates
              </CardTitle>
              <CardDescription>
                Choose which candidates to include in this campaign.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="screening">Screening</SelectItem>
                      <SelectItem value="interview">Interview</SelectItem>
                      <SelectItem value="offer">Offer</SelectItem>
                      <SelectItem value="hired">Hired</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                      Select All
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={selectNone}>
                      Select None
                    </Button>
                  </div>
                </div>

                <Badge variant="secondary">
                  {selectedCandidateIds.size} selected
                </Badge>
              </div>

              <Separator />

              {loadingCandidates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : candidates.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No candidates found for this job. Add candidates first before creating a campaign.
                  </p>
                </div>
              ) : (
                <div className="max-h-[400px] space-y-2 overflow-y-auto">
                  {candidates.map((candidate) => {
                    const isSelected = selectedCandidateIds.has(candidate.id)
                    return (
                      <div
                        key={candidate.id}
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-accent/50'
                        }`}
                        onClick={() => toggleCandidate(candidate.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleCandidate(candidate.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {candidate.firstName} {candidate.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {candidate.email || 'No email'}
                            {candidate.currentTitle && ` - ${candidate.currentTitle}`}
                            {candidate.currentCompany && ` at ${candidate.currentCompany}`}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {candidate.status}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Generate Email */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Compose Email
              </CardTitle>
              <CardDescription>
                Write or generate the initial outreach email for your campaign.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailEditor
                subject={subject}
                body={body}
                onSubjectChange={(val) => setValue('subject', val)}
                onBodyChange={(val) => setValue('body', val)}
                onGenerateWithAI={handleGenerateEmail}
                isGenerating={generating}
                showGenerateButton={true}
              />
            </CardContent>
          </Card>
        )}

        {/* Step 3: Follow-up Sequence */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Follow-up Sequence
              </CardTitle>
              <CardDescription>
                Add up to 3 automated follow-up emails. These will be sent if the candidate does not reply.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {followUps.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    No follow-ups configured. You can add up to 3 follow-up emails.
                  </p>
                </div>
              )}

              {followUps.map((followUp, index) => (
                <div key={followUp.id} className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Follow-up {index + 1}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeFollowUp(followUp.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">
                      Send follow-up after
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={followUp.delayDays}
                        onChange={(e) =>
                          updateFollowUp(followUp.id, 'delayDays', parseInt(e.target.value) || 1)
                        }
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">days after previous email</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Subject</Label>
                    <Input
                      placeholder="Follow-up subject line..."
                      value={followUp.subject}
                      onChange={(e) => updateFollowUp(followUp.id, 'subject', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Body</Label>
                    <Textarea
                      placeholder="Follow-up email body..."
                      value={followUp.body}
                      onChange={(e) => updateFollowUp(followUp.id, 'body', e.target.value)}
                      className="min-h-[120px]"
                    />
                  </div>
                </div>
              ))}

              {followUps.length < 3 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={addFollowUp}
                >
                  <Plus className="h-4 w-4" />
                  Add Follow-up Email
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Review & Launch */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Campaign Name</p>
                  <p className="text-sm font-semibold">{campaignName || 'Untitled Campaign'}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Recipients</p>
                  <p className="text-sm">{selectedCandidateIds.size} candidates selected</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedCandidates.slice(0, 10).map((c) => (
                      <Badge key={c.id} variant="outline" className="text-xs">
                        {c.firstName} {c.lastName}
                      </Badge>
                    ))}
                    {selectedCandidates.length > 10 && (
                      <Badge variant="secondary" className="text-xs">
                        +{selectedCandidates.length - 10} more
                      </Badge>
                    )}
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email Preview</p>
                  <div className="mt-2 rounded-lg border p-4 space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Subject:</span> {subject}
                    </p>
                    <Separator />
                    <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {body}
                    </div>
                  </div>
                </div>
                {followUps.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Follow-up Schedule</p>
                      <div className="mt-2 space-y-2">
                        {followUps.map((followUp, index) => (
                          <div key={followUp.id} className="flex items-center gap-3 rounded-lg border p-3">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {followUp.subject || `Follow-up ${index + 1}`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {followUp.delayDays} days after {index === 0 ? 'initial email' : `follow-up ${index}`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={creating || savingDraft}
              >
                {savingDraft ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save as Draft'
                )}
              </Button>
              <Button
                type="button"
                onClick={handleLaunchCampaign}
                disabled={creating || savingDraft}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Launching...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Launch Campaign
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CampaignWizard>

      {/* Navigation buttons (not shown on step 4 which has its own) */}
      {currentStep < 4 && (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            type="button"
            onClick={goNext}
            disabled={!canGoNext()}
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
