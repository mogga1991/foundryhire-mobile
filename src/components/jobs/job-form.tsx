'use client'

import { useState, useCallback, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  X,
  Briefcase,
  MapPin,
  DollarSign,
  Building2,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useCreateJob, useUpdateJob } from '@/hooks/use-jobs'

const INDUSTRY_SECTORS = [
  'General Construction',
  'Residential Construction',
  'Commercial Construction',
  'Heavy Civil / Infrastructure',
  'Industrial Construction',
  'Specialty Trades',
  'MEP (Mechanical, Electrical, Plumbing)',
  'Environmental & Remediation',
  'Oil & Gas / Energy',
  'Utilities',
  'Transportation',
  'Water / Wastewater',
  'Mining',
  'Telecommunications',
  'Renovation / Restoration',
]

const EMPLOYMENT_TYPES = [
  'Full-time',
  'Part-time',
  'Contract',
  'Temporary',
  'Per Diem',
]

const jobFormSchema = z.object({
  title: z.string().min(3, 'Job title must be at least 3 characters'),
  location: z.string().min(2, 'Location is required'),
  department: z.string().optional(),
  employment_type: z.string().optional(),
  experience_level: z.string().optional(),
  salary_min: z.coerce.number().min(0, 'Salary must be positive').optional(),
  salary_max: z.coerce.number().min(0, 'Salary must be positive').optional(),
  salary_currency: z.string().optional(),
  skills_required: z.array(z.string()).min(1, 'Add at least one required skill'),
  skills_preferred: z.array(z.string()).optional(),
  description: z.string().min(50, 'Description must be at least 50 characters'),
  status: z.enum(['draft', 'active']),
})

type JobFormValues = z.infer<typeof jobFormSchema>

const STEPS = [
  { id: 1, title: 'Basic Info', description: 'Job title, location, and salary' },
  { id: 2, title: 'Requirements', description: 'Skills and experience' },
  { id: 3, title: 'Description', description: 'Job description details' },
  { id: 4, title: 'Review & Publish', description: 'Review and publish your job' },
]

interface SkillTagInputProps {
  skills: string[]
  onAdd: (skill: string) => void
  onRemove: (skill: string) => void
  placeholder?: string
}

function SkillTagInput({ skills, onAdd, onRemove, placeholder }: SkillTagInputProps) {
  const [inputValue, setInputValue] = useState('')

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = inputValue.trim()
      if (trimmed && !skills.includes(trimmed)) {
        onAdd(trimmed)
        setInputValue('')
      }
    }
    if (e.key === 'Backspace' && inputValue === '' && skills.length > 0) {
      onRemove(skills[skills.length - 1])
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[2.25rem]">
        {skills.map((skill) => (
          <Badge key={skill} variant="secondary" className="gap-1 pr-1">
            {skill}
            <button
              type="button"
              onClick={() => onRemove(skill)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
            >
              <X className="size-3" />
              <span className="sr-only">Remove {skill}</span>
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? 'Type a skill and press Enter'}
      />
    </div>
  )
}

interface JobFormProps {
  jobId?: string
  initialData?: Partial<JobFormValues>
  aiAssisted?: boolean
  confidenceScores?: {
    overall: number
    fields: Record<string, number>
  }
  autoGenerateLeads?: boolean
  onSuccess?: (jobId: string) => void
}

export function JobForm({ jobId, initialData, aiAssisted, confidenceScores, autoGenerateLeads = false, onSuccess }: JobFormProps = {}) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingLeads, setIsGeneratingLeads] = useState(false)
  const { createJob, loading: isCreating } = useCreateJob()
  const { updateJob, loading: isUpdating } = useUpdateJob()
  const isSubmitting = isCreating || isUpdating || isGeneratingLeads
  const isEditMode = !!jobId

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema) as Resolver<JobFormValues>,
    defaultValues: {
      title: initialData?.title ?? '',
      location: initialData?.location ?? '',
      department: initialData?.department ?? '',
      employment_type: initialData?.employment_type ?? 'Full-time',
      experience_level: initialData?.experience_level ?? '',
      salary_min: initialData?.salary_min ?? undefined,
      salary_max: initialData?.salary_max ?? undefined,
      salary_currency: initialData?.salary_currency ?? 'USD',
      skills_required: initialData?.skills_required ?? [],
      skills_preferred: initialData?.skills_preferred ?? [],
      description: initialData?.description ?? '',
      status: initialData?.status ?? 'draft',
    },
    mode: 'onChange',
  })

  const progressValue = (currentStep / STEPS.length) * 100

  // Calculate AI-filled fields count
  const aiFilledCount = aiAssisted && initialData ? Object.keys(initialData).filter(key => {
    const value = initialData[key as keyof typeof initialData]
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== null && value !== ''
  }).length : 0

  const totalFields = 13 // Total fields in the form

  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    let fieldsToValidate: (keyof JobFormValues)[] = []

    switch (currentStep) {
      case 1:
        fieldsToValidate = ['title', 'location']
        break
      case 2:
        fieldsToValidate = ['skills_required']
        break
      case 3:
        fieldsToValidate = ['description']
        break
      default:
        return true
    }

    const result = await form.trigger(fieldsToValidate)
    return result
  }, [currentStep, form])

  const handleNext = async () => {
    const isValid = await validateCurrentStep()
    if (isValid && currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleGenerateDescription = async () => {
    const title = form.getValues('title')
    const location = form.getValues('location')
    const skillsRequired = form.getValues('skills_required')
    const salaryMin = form.getValues('salary_min')
    const salaryMax = form.getValues('salary_max')

    if (!title) {
      form.setError('title', { message: 'Title is required to generate a description' })
      setCurrentStep(1)
      return
    }

    setIsGenerating(true)

    try {
      const response = await fetch('/api/ai/generate-job-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          requirements: skillsRequired,
          location,
          salaryRange:
            salaryMin && salaryMax
              ? { min: Number(salaryMin), max: Number(salaryMax) }
              : undefined,
        }),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to generate description'
        try {
          const errorData = (await response.json()) as { error?: string }
          if (errorData.error) {
            errorMessage = errorData.error
          }
        } catch {
          // Ignore body parse failures and keep fallback message.
        }
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as {
        success?: boolean
        description?: string
        source?: 'ai' | 'template'
      }

      if (data.success && data.description) {
        form.setValue('description', data.description, { shouldValidate: true })
        if (data.source === 'template') {
          toast.info('AI service unavailable. Added a smart starter description instead.')
        } else {
          toast.success('Job description generated')
        }
      } else {
        throw new Error('Failed to generate description')
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to generate job description:', error)
      }
      toast.error(
        error instanceof Error ? error.message : 'Failed to generate description'
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const getCsrfToken = async (): Promise<string> => {
    const csrfRes = await fetch('/api/csrf', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    })

    if (!csrfRes.ok) {
      throw new Error('Failed to initialize secure request')
    }

    const csrfData = (await csrfRes.json()) as { token?: string }
    if (!csrfData.token) {
      throw new Error('Missing CSRF token')
    }

    return csrfData.token
  }

  const handleSubmit = async (status: 'draft' | 'active') => {
    form.setValue('status', status)

    const isValid = await form.trigger()
    if (!isValid) return

    const values = form.getValues()

    const jobData = {
      title: values.title,
      location: values.location || null,
      department: values.department || null,
      employment_type: values.employment_type || null,
      experience_level: values.experience_level || null,
      salary_min: values.salary_min ? Number(values.salary_min) : null,
      salary_max: values.salary_max ? Number(values.salary_max) : null,
      salary_currency: values.salary_currency || 'USD',
      skills_required: values.skills_required,
      skills_preferred: values.skills_preferred ?? [],
      description: values.description,
      status,
      company_id: '',
      published_at: status === 'active' ? new Date().toISOString() : null,
      auto_generate_leads: autoGenerateLeads,
    }

    if (isEditMode && jobId) {
      const updated = await updateJob(jobId, jobData)
      if (updated) {
        if (onSuccess) {
          onSuccess(jobId)
        } else {
          router.push(`/jobs/${jobId}`)
        }
      }
    } else {
      const newJob = await createJob(jobData)
      if (newJob) {
        // If auto-generate leads is enabled and job is active, trigger lead generation
        if (autoGenerateLeads && status === 'active' && values.title && values.location) {
          setIsGeneratingLeads(true)
          toast.loading('Generating qualified leads...', {
            description: 'This may take a minute. You can navigate away and check back later.',
            id: 'lead-generation',
          })

          try {
            const csrfToken = await getCsrfToken()
            const leadResponse = await fetch('/api/leads/generate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken,
              },
              body: JSON.stringify({
                jobId: newJob.id,
                jobTitle: values.title,
                location: values.location,
                maxLeads: 30,
              }),
            })

            if (!leadResponse.ok) {
              let apiError = 'Failed to generate leads'
              try {
                const errorData = (await leadResponse.json()) as { error?: string; message?: string }
                apiError = errorData.error || errorData.message || apiError
              } catch {
                // Ignore parse failures and keep default error message.
              }

              if (process.env.NODE_ENV !== 'production') {
                console.error('Lead generation failed:', apiError)
              }

              const isCsrfError =
                apiError === 'Invalid CSRF token' || apiError === 'CSRF token missing'
              const isAuthError = apiError === 'Unauthorized' || leadResponse.status === 401

              toast.error('Failed to generate leads', {
                description: isCsrfError
                  ? 'Your secure session expired. Refresh the page and try generating leads again.'
                  : isAuthError
                    ? 'Your session expired. Sign in again, then retry lead generation.'
                    : 'You can manually generate leads later from the job page.',
                id: 'lead-generation',
              })
            } else {
              const leadResult = await leadResponse.json()
              if (process.env.NODE_ENV !== 'production') {
                console.log('Lead generation successful:', leadResult.stats)
              }
              toast.success(`Generated ${leadResult.stats.totalLeads} qualified leads`, {
                description: `${leadResult.stats.emailsFound} emails found, ${leadResult.stats.phonesFound} phones found`,
                id: 'lead-generation',
              })
            }
          } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
              console.error('Error generating leads:', error)
            }
            toast.error('Failed to generate leads', {
              description: 'You can manually generate leads later from the job page.',
              id: 'lead-generation',
            })
          } finally {
            setIsGeneratingLeads(false)
          }
        }

        if (onSuccess) {
          onSuccess(newJob.id)
        } else {
          router.push(`/jobs/${newJob.id}`)
        }
      }
    }
  }

  // Helper to check if a field was AI-filled
  const isAIFilled = (fieldName: string): boolean => {
    if (!aiAssisted || !initialData) return false
    const value = initialData[fieldName as keyof typeof initialData]
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== null && value !== ''
  }

  // Helper component for AI-filled indicator
  const AIFilledBadge = ({ fieldName }: { fieldName: string }) => {
    if (!isAIFilled(fieldName)) return null
    const confidence = confidenceScores?.fields?.[fieldName]
    return (
      <Badge variant="outline" className="ml-2 text-xs font-normal border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-300">
        <CheckCircle2 className="size-3 mr-1" />
        AI Filled
        {confidence && ` ${Math.round(confidence)}%`}
      </Badge>
    )
  }

  return (
    <div className="space-y-8">
      {/* Progress */}
      <div className="space-y-4">
        <Progress value={progressValue} className="h-2" />
        <div className="flex justify-between">
          {STEPS.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                if (step.id < currentStep) {
                  setCurrentStep(step.id)
                }
              }}
              className={`flex flex-col items-center gap-1 text-xs transition-colors ${
                step.id === currentStep
                  ? 'text-primary font-medium'
                  : step.id < currentStep
                    ? 'text-primary/70 cursor-pointer'
                    : 'text-muted-foreground'
              }`}
            >
              <span
                className={`flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                  step.id === currentStep
                    ? 'border-primary bg-primary text-primary-foreground'
                    : step.id < currentStep
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted-foreground/30'
                }`}
              >
                {step.id}
              </span>
              <span className="hidden sm:block">{step.title}</span>
            </button>
          ))}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()}>
          {/* AI Assistance Banner */}
          {aiAssisted && (
            <Alert className="mb-6 border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/20">
              <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <AlertDescription className="text-purple-900 dark:text-purple-100">
                <span className="font-medium">AI has filled {aiFilledCount} of {totalFields} fields.</span>
                {' '}Please review and complete any missing information.
                {confidenceScores && confidenceScores.overall < 80 && (
                  <span className="block mt-1 text-sm text-purple-700 dark:text-purple-300">
                    Some fields have low confidence. Double-check for accuracy.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="size-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        Job Title *
                        <AIFilledBadge fieldName="title" />
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Senior Project Manager"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        Location *
                        <AIFilledBadge fieldName="location" />
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <Input
                            className="pl-9"
                            placeholder="e.g. Houston, TX"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry Sector</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select industry sector" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INDUSTRY_SECTORS.map((sector) => (
                            <SelectItem key={sector} value={sector}>
                              {sector}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="employment_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employment Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select employment type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EMPLOYMENT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="salary_min"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salary Min</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input
                              type="number"
                              className="pl-9"
                              placeholder="e.g. 80000"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => {
                                const val = e.target.value
                                field.onChange(val === '' ? undefined : Number(val))
                              }}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="salary_max"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salary Max</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input
                              type="number"
                              className="pl-9"
                              placeholder="e.g. 120000"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => {
                                const val = e.target.value
                                field.onChange(val === '' ? undefined : Number(val))
                              }}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Requirements */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="size-5" />
                  Requirements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="experience_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Experience Level</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select experience level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="entry">Entry Level (0-2 years)</SelectItem>
                          <SelectItem value="mid">Mid Level (3-5 years)</SelectItem>
                          <SelectItem value="senior">Senior (6-9 years)</SelectItem>
                          <SelectItem value="lead">Lead (10-14 years)</SelectItem>
                          <SelectItem value="executive">Executive (15+ years)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="skills_required"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        Required Skills *
                        <AIFilledBadge fieldName="skills_required" />
                      </FormLabel>
                      <FormControl>
                        <SkillTagInput
                          skills={field.value}
                          onAdd={(skill) =>
                            field.onChange([...field.value, skill])
                          }
                          onRemove={(skill) =>
                            field.onChange(
                              field.value.filter((s: string) => s !== skill)
                            )
                          }
                          placeholder="Type a required skill and press Enter"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="skills_preferred"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nice-to-Have Skills</FormLabel>
                      <FormControl>
                        <SkillTagInput
                          skills={field.value ?? []}
                          onAdd={(skill) =>
                            field.onChange([...(field.value ?? []), skill])
                          }
                          onRemove={(skill) =>
                            field.onChange(
                              (field.value ?? []).filter(
                                (s: string) => s !== skill
                              )
                            )
                          }
                          placeholder="Type a preferred skill and press Enter"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 3: Description */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle>Job Description</CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateDescription}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        Generate with AI
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isGenerating && (
                  <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <Loader2 className="size-5 animate-spin text-primary" />
                    <div>
                      <p className="text-sm font-medium">
                        Generating job description...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        AI is crafting a professional description based on your
                        job details.
                      </p>
                    </div>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        Description *
                        <AIFilledBadge fieldName="description" />
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Write a detailed job description or use AI to generate one..."
                          className="min-h-[180px] sm:min-h-[320px] resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 4: Review & Publish */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Review Your Job Posting</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Basic Info Review */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Basic Information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground text-xs">
                          Job Title
                        </Label>
                        <p className="font-medium">
                          {form.getValues('title') || '--'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">
                          Location
                        </Label>
                        <p className="font-medium">
                          {form.getValues('location') || '--'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">
                          Industry Sector
                        </Label>
                        <p className="font-medium">
                          {form.getValues('department') || '--'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">
                          Employment Type
                        </Label>
                        <p className="font-medium">
                          {form.getValues('employment_type') || '--'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">
                          Salary Range
                        </Label>
                        <p className="font-medium">
                          {form.getValues('salary_min') &&
                          form.getValues('salary_max')
                            ? `${form.getValues('salary_currency') ?? 'USD'} ${Number(form.getValues('salary_min')).toLocaleString()} - ${Number(form.getValues('salary_max')).toLocaleString()}`
                            : form.getValues('salary_min')
                              ? `${form.getValues('salary_currency') ?? 'USD'} ${Number(form.getValues('salary_min')).toLocaleString()}+`
                              : '--'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">
                          Experience Level
                        </Label>
                        <p className="font-medium capitalize">
                          {form.getValues('experience_level') || '--'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Skills Review */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Skills
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-muted-foreground text-xs">
                          Required Skills
                        </Label>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {form.getValues('skills_required').map((skill) => (
                            <Badge key={skill} variant="secondary">
                              {skill}
                            </Badge>
                          ))}
                          {form.getValues('skills_required').length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              None added
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">
                          Nice-to-Have Skills
                        </Label>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {(form.getValues('skills_preferred') ?? []).map(
                            (skill) => (
                              <Badge key={skill} variant="outline">
                                {skill}
                              </Badge>
                            )
                          )}
                          {(form.getValues('skills_preferred') ?? []).length ===
                            0 && (
                            <p className="text-sm text-muted-foreground">
                              None added
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Description Review */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Job Description
                    </h3>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {form.getValues('description') || 'No description added.'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Lead Generation Status */}
              {isGeneratingLeads && (
                <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-900 dark:text-blue-100">
                    <span className="font-medium">Generating qualified leads...</span>
                    <span className="block mt-1 text-sm text-blue-700 dark:text-blue-300">
                      AI is sourcing 20-50 candidates using free-tier APIs. This may take a minute.
                    </span>
                  </AlertDescription>
                </Alert>
              )}

              {/* Submit Actions */}
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => handleSubmit('draft')}
                  disabled={isSubmitting}
                >
                  {isCreating || isUpdating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Save as Draft
                </Button>
                <Button
                  type="button"
                  size="lg"
                  onClick={() => handleSubmit('active')}
                  disabled={isSubmitting}
                >
                  {isCreating || isUpdating || isGeneratingLeads ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {isGeneratingLeads ? 'Generating Leads...' : 'Publish Job'}
                </Button>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          {currentStep < 4 && (
            <div className="flex justify-between mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="size-4" />
                Previous
              </Button>
              <Button type="button" onClick={handleNext}>
                Next
                <ArrowRight className="size-4" />
              </Button>
            </div>
          )}

          {currentStep === 4 && (
            <div className="flex justify-start mt-6">
              <Button type="button" variant="outline" onClick={handlePrevious}>
                <ArrowLeft className="size-4" />
                Previous
              </Button>
            </div>
          )}
        </form>
      </Form>
    </div>
  )
}
