'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ResumeViewer } from '@/components/candidates/resume-viewer'
import { ResumeAnalysis } from '@/components/candidates/resume-analysis'
import { SkillsMatch } from '@/components/candidates/skills-match'
import { ActivityFeed } from '@/components/candidates/activity-feed'
import {
  useCandidate,
  useUpdateCandidate,
  useAnalyzeResume,
} from '@/hooks/use-candidates'
import type { Job } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Mail,
  Phone,
  Linkedin,
  MapPin,
  Briefcase,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Loader2,
  Star,
  FileText,
  GraduationCap,
  Building2,
  Award,
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface AiScoreBreakdown {
  reasoning?: string
  strengths?: string[]
  concerns?: string[]
  recommendation?: string
}

interface ResumeAnalysisData {
  summary: string
  skills: string[]
  experience: {
    title: string
    company: string
    duration: string
    description: string
  }[]
  education: {
    degree: string
    institution: string
    year: string
  }[]
  certifications: string[]
  greenFlags: string[]
  redFlags: string[]
  recommendation: string
}

// ============================================================================
// Helper Functions
// ============================================================================

function getScoreColor(score: number | null): string {
  if (score === null) return 'bg-muted text-muted-foreground'
  if (score >= 80) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
  if (score >= 60) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
}

function getScoreBorderColor(score: number | null): string {
  if (score === null) return 'border-muted'
  if (score >= 80) return 'border-emerald-300 dark:border-emerald-700'
  if (score >= 60) return 'border-amber-300 dark:border-amber-700'
  return 'border-red-300 dark:border-red-700'
}

function parseAiScoreBreakdown(data: unknown): AiScoreBreakdown | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  return data as AiScoreBreakdown
}

// ============================================================================
// CandidateDetailPage
// ============================================================================

export default function CandidateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string
  const candidateId = params.candidateId as string

  const { candidate, loading, error, refetch } = useCandidate(candidateId)
  const { updateCandidate } = useUpdateCandidate()
  const { analyzeResume, loading: analyzingResume } = useAnalyzeResume()

  const [job, setJob] = useState<Job | null>(null)
  const [resumeAnalysis, setResumeAnalysis] = useState<ResumeAnalysisData | null>(null)

  // Fetch job details
  useEffect(() => {
    async function fetchJob() {
      try {
        const res = await fetch(`/api/jobs?id=${jobId}`)
        if (!res.ok) throw new Error('Failed to fetch job')
        const result = await res.json()
        setJob(result.data)
      } catch {
        // Handle error silently
      }
    }

    fetchJob()
  }, [jobId])

  // Handle status change
  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      if (!candidate) return

      const updated = await updateCandidate(candidate.id, { status: newStatus })
      if (updated) {
        // Log activity via API
        await fetch(`/api/candidates/${candidate.id}/activities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activity_type: 'status_change',
            title: `Status changed to ${newStatus}`,
            description: `Candidate status updated from "${candidate.status}" to "${newStatus}"`,
          }),
        })
        refetch()
      }
    },
    [candidate, updateCandidate, refetch]
  )

  // Handle resume upload
  const handleResumeUploaded = useCallback(
    async (url: string) => {
      if (!candidate) return

      await updateCandidate(candidate.id, { resumeUrl: url })

      // Log activity via API
      await fetch(`/api/candidates/${candidate.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_type: 'resume_uploaded',
          title: 'Resume uploaded',
          description: 'A new resume was uploaded for this candidate.',
        }),
      })
      refetch()
    },
    [candidate, updateCandidate, refetch]
  )

  // Handle analyze resume
  const handleAnalyzeResume = useCallback(async () => {
    if (!candidate?.resumeText || !jobId) return

    const result = await analyzeResume(candidate.resumeText, jobId)
    if (result && result.success) {
      setResumeAnalysis(result)

      // Update candidate with AI summary from analysis
      await updateCandidate(candidate.id, {
        aiSummary: result.summary,
      })

      // Log activity via API
      await fetch(`/api/candidates/${candidate.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_type: 'scored',
          title: 'Resume analyzed by AI',
          description: `AI analyzed the resume. Recommendation: ${result.recommendation}`,
        }),
      })
    }
  }, [candidate, jobId, analyzeResume, updateCandidate])

  // Parse existing AI data
  const aiBreakdown = candidate
    ? parseAiScoreBreakdown(candidate.aiScoreBreakdown)
    : null

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !candidate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground mb-4">
          {error || 'Candidate not found'}
        </p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => router.push(`/jobs/${jobId}/candidates`)}
        >
          <ArrowLeft className="size-4" />
          Back to Candidates
        </Button>

        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
              {candidate.profileImageUrl ? (
                <img
                  src={candidate.profileImageUrl}
                  alt={`${candidate.firstName} ${candidate.lastName}`}
                  className="size-16 rounded-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold text-primary">
                  {candidate.firstName.charAt(0)}
                  {candidate.lastName.charAt(0)}
                </span>
              )}
            </div>

            {/* Name & Info */}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {candidate.firstName} {candidate.lastName}
              </h1>
              {candidate.headline ? (
                <p className="text-muted-foreground mt-0.5">{candidate.headline}</p>
              ) : (candidate.currentTitle || candidate.currentCompany) ? (
                <p className="text-muted-foreground mt-0.5">
                  {candidate.currentTitle}
                  {candidate.currentTitle && candidate.currentCompany && ' at '}
                  {candidate.currentCompany}
                </p>
              ) : null}

              {/* Contact & Location */}
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                {candidate.location && (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-3.5" />
                    {candidate.location}
                  </span>
                )}
                {candidate.experienceYears !== null && (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <Briefcase className="size-3.5" />
                    {candidate.experienceYears} years experience
                  </span>
                )}
                {candidate.email && (
                  <a
                    href={`mailto:${candidate.email}`}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Mail className="size-3.5" />
                    {candidate.email}
                  </a>
                )}
                {candidate.phone && (
                  <a
                    href={`tel:${candidate.phone}`}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Phone className="size-3.5" />
                    {candidate.phone}
                  </a>
                )}
                {candidate.linkedinUrl && (
                  <a
                    href={candidate.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    <Linkedin className="size-3.5" />
                    LinkedIn
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* AI Score Badge */}
          <div
            className={cn(
              'flex flex-col items-center justify-center size-20 rounded-full border-[3px] shrink-0',
              getScoreColor(candidate.aiScore),
              getScoreBorderColor(candidate.aiScore)
            )}
          >
            <span className="text-2xl font-bold">
              {candidate.aiScore !== null ? candidate.aiScore : '--'}
            </span>
            <span className="text-[10px] font-medium -mt-1">AI Score</span>
          </div>
        </div>
      </div>

      {/* Status & Actions */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          <Select value={candidate.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="responded">Responded</SelectItem>
              <SelectItem value="interviewing">Interviewing</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {candidate.resumeText && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAnalyzeResume}
            disabled={analyzingResume}
          >
            {analyzingResume ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FileText className="size-3.5" />
            )}
            Analyze Resume
          </Button>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Candidate Info & Resume */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Reasoning Card (if available) */}
          {aiBreakdown && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="size-4" />
                  AI Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Reasoning */}
                {aiBreakdown.reasoning && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {aiBreakdown.reasoning}
                  </p>
                )}

                {/* Strengths */}
                {aiBreakdown.strengths && aiBreakdown.strengths.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-1.5">
                      Strengths
                    </h4>
                    <ul className="space-y-1">
                      {aiBreakdown.strengths.map((strength, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="size-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Concerns */}
                {aiBreakdown.concerns && aiBreakdown.concerns.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-1.5">
                      Concerns
                    </h4>
                    <ul className="space-y-1">
                      {aiBreakdown.concerns.map((concern, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <AlertCircle className="size-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">{concern}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendation */}
                {aiBreakdown.recommendation && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Recommendation:</span>
                    <Badge variant="outline" className="capitalize">
                      {aiBreakdown.recommendation.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* About */}
          {candidate.about && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {candidate.about}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Work Experience */}
          {Array.isArray(candidate.experience) && (candidate.experience as any[]).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="size-4" />
                  Work Experience
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(candidate.experience as any[]).map((exp: any, i: number) => (
                    <div key={i} className="relative pl-4 border-l-2 border-muted">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{exp.title || 'Untitled Role'}</p>
                          <p className="text-sm text-muted-foreground">{exp.company}</p>
                        </div>
                        {exp.duration && (
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">{exp.duration}</span>
                        )}
                      </div>
                      {exp.location && (
                        <p className="text-xs text-muted-foreground mt-0.5">{exp.location}</p>
                      )}
                      {exp.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Education */}
          {Array.isArray(candidate.education) && (candidate.education as any[]).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="size-4" />
                  Education
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(candidate.education as any[]).map((edu: any, i: number) => (
                    <div key={i}>
                      <p className="font-medium text-sm">{edu.school}</p>
                      {(edu.degree || edu.fieldOfStudy) && (
                        <p className="text-sm text-muted-foreground">
                          {edu.degree}{edu.degree && edu.fieldOfStudy ? ', ' : ''}{edu.fieldOfStudy}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Certifications */}
          {Array.isArray(candidate.certifications) && (candidate.certifications as any[]).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="size-4" />
                  Certifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(candidate.certifications as any[]).map((cert: any, i: number) => (
                    <div key={i}>
                      <p className="font-medium text-sm">{cert.name}</p>
                      {cert.issuingOrganization && (
                        <p className="text-xs text-muted-foreground">{cert.issuingOrganization}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resume Viewer */}
          <ResumeViewer
            candidateId={candidate.id}
            resumeUrl={candidate.resumeUrl}
            resumeText={candidate.resumeText}
            onUploadComplete={handleResumeUploaded}
          />

          {/* Resume Analysis (if analyzed) */}
          {resumeAnalysis && <ResumeAnalysis analysis={resumeAnalysis} />}

          {/* Activity Feed */}
          <ActivityFeed
            candidateId={candidate.id}
            companyId={candidate.companyId}
          />
        </div>

        {/* Right Column - AI Analysis & Skills */}
        <div className="space-y-6">
          {/* AI Summary */}
          {candidate.aiSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {candidate.aiSummary}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Skills Match */}
          <SkillsMatch
            requiredSkills={job?.skillsRequired || []}
            candidateSkills={candidate.skills || []}
          />

          {/* Candidate Skills */}
          {candidate.skills && candidate.skills.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">All Skills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.skills.map((skill) => (
                    <Badge key={skill} variant="outline" className="text-xs font-normal">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Candidate Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Source</span>
                <span className="capitalize">{candidate.source || 'Direct'}</span>

                <span className="text-muted-foreground">Stage</span>
                <span className="capitalize">{candidate.stage}</span>

                <span className="text-muted-foreground">Added</span>
                <span>
                  {new Date(candidate.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>

                {candidate.appliedAt && (
                  <>
                    <span className="text-muted-foreground">Applied</span>
                    <span>
                      {new Date(candidate.appliedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </>
                )}
              </div>

              <Separator />

              {/* Links */}
              <div className="space-y-2">
                {candidate.githubUrl && (
                  <a
                    href={candidate.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                    GitHub Profile
                  </a>
                )}
                {candidate.portfolioUrl && (
                  <a
                    href={candidate.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                    Portfolio
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
