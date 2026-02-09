'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Upload, User, Briefcase, MapPin, Phone, Linkedin, FileText, Award, Trash2, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  phone: z.string().optional(),
  location: z.string().optional(),
  currentTitle: z.string().optional(),
  currentCompany: z.string().optional(),
  experienceYears: z.number().min(0).max(70).optional().nullable(),
  linkedinUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  skills: z.string().optional(), // Comma-separated skills
})

type ProfileFormValues = z.infer<typeof profileSchema>

interface CandidateProfileFormProps {
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    location: string | null
    currentTitle: string | null
    currentCompany: string | null
    experienceYears: number | null
    linkedinUrl: string | null
    bio: string | null
    skills: string[] | null
    resumeUrl: string | null
  }
}

export function CandidateProfileForm({ user }: CandidateProfileFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [isUploadingResume, setIsUploadingResume] = useState(false)
  const [isDeletingResume, setIsDeletingResume] = useState(false)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || '',
      location: user.location || '',
      currentTitle: user.currentTitle || '',
      currentCompany: user.currentCompany || '',
      experienceYears: user.experienceYears,
      linkedinUrl: user.linkedinUrl || '',
      bio: user.bio || '',
      skills: user.skills?.join(', ') || '',
    },
  })

  async function onSubmit(data: ProfileFormValues) {
    setIsLoading(true)

    try {
      // Convert comma-separated skills to array
      const skillsArray = data.skills
        ? data.skills.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
        : []

      // Ensure experienceYears is a number or null
      const experienceYears = data.experienceYears ? Number(data.experienceYears) : null

      const res = await fetch('/api/candidate/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          experienceYears,
          skills: skillsArray,
        }),
      })

      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error || 'Failed to update profile')
      }

      toast.success('Profile updated!', {
        description: 'Your profile has been updated successfully.',
      })

      router.refresh()
    } catch (error) {
      console.error('Profile update error:', error)
      toast.error('Failed to update profile', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResumeUpload() {
    if (!resumeFile) {
      toast.error('Please select a file first')
      return
    }

    setIsUploadingResume(true)
    try {
      const formData = new FormData()
      formData.append('resume', resumeFile)

      const res = await fetch('/api/candidate/resume/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to upload resume')
      }

      toast.success('Resume uploaded!', {
        description: 'Your resume has been uploaded successfully.',
      })

      setResumeFile(null)
      router.refresh()
    } catch (error) {
      console.error('Resume upload error:', error)
      toast.error('Failed to upload resume', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    } finally {
      setIsUploadingResume(false)
    }
  }

  async function handleDeleteResume() {
    if (!confirm('Are you sure you want to delete your resume? This action cannot be undone.')) {
      return
    }

    setIsDeletingResume(true)
    try {
      const res = await fetch('/api/candidate/resume/upload', {
        method: 'DELETE',
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to delete resume')
      }

      toast.success('Resume deleted', {
        description: 'Your resume has been removed.',
      })

      router.refresh()
    } catch (error) {
      console.error('Resume delete error:', error)
      toast.error('Failed to delete resume', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    } finally {
      setIsDeletingResume(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-900">
            <User className="h-5 w-5" />
            Basic Information
          </CardTitle>
          <CardDescription>Your personal contact information</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John"
                          className="focus-visible:ring-orange-500"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Doe"
                          className="focus-visible:ring-orange-500"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="tel"
                            placeholder="+1 (555) 000-0000"
                            className="pl-10 focus-visible:ring-orange-500"
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
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="New York, NY"
                            className="pl-10 focus-visible:ring-orange-500"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="pt-4 border-t">
                <Button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Professional Information */}
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-900">
            <Briefcase className="h-5 w-5" />
            Professional Information
          </CardTitle>
          <CardDescription>Your current work experience</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currentTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Construction Manager"
                          className="focus-visible:ring-orange-500"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currentCompany"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Company</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="ABC Construction"
                          className="focus-visible:ring-orange-500"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="experienceYears"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Years of Experience</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="70"
                        placeholder="10"
                        className="focus-visible:ring-orange-500"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Total years of construction experience
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="linkedinUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LinkedIn URL</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Linkedin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="url"
                          placeholder="https://linkedin.com/in/yourprofile"
                          className="pl-10 focus-visible:ring-orange-500"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4 border-t">
                <Button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Bio & Skills */}
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-900">
            <FileText className="h-5 w-5" />
            About & Skills
          </CardTitle>
          <CardDescription>Tell employers about yourself and your expertise</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Professional Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell employers about your construction experience, specialties, and what makes you a great candidate..."
                        className="min-h-32 focus-visible:ring-orange-500"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {field.value?.length || 0} / 500 characters
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="skills"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skills</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Award className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Textarea
                          placeholder="Project Management, OSHA Safety, Blueprint Reading, Cost Estimation..."
                          className="pl-10 focus-visible:ring-orange-500"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Separate skills with commas (e.g., Carpentry, Welding, Electrical)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4 border-t">
                <Button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Resume Upload */}
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-900">
            <Upload className="h-5 w-5" />
            Resume
          </CardTitle>
          <CardDescription>Upload your resume or CV (PDF format preferred)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user.resumeUrl && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-orange-900 font-medium mb-2">Current Resume</p>
                  <a
                    href={user.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 underline"
                  >
                    View Resume
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Button
                  type="button"
                  onClick={handleDeleteResume}
                  variant="outline"
                  size="sm"
                  disabled={isDeletingResume}
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  {isDeletingResume ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
              className="focus-visible:ring-orange-500"
              disabled={isUploadingResume}
            />
            {resumeFile && (
              <p className="text-sm text-gray-600">
                Selected: {resumeFile.name} ({(resumeFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <Button
            type="button"
            onClick={handleResumeUpload}
            disabled={!resumeFile || isUploadingResume}
            className="w-full bg-orange-600 hover:bg-orange-700"
          >
            {isUploadingResume ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {user.resumeUrl ? 'Replace Resume' : 'Upload Resume'}
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground">
            Accepted formats: PDF, DOC, DOCX (Max 5MB)
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
