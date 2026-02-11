import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Video,
  Calendar,
  Clock,
  User,
  Briefcase,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  MessageSquare,
  BarChart3,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  MoreHorizontal,
  PhoneOff,
  FileText,
} from 'lucide-react'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  interviews,
  interviewFeedback,
  candidates,
  jobs,
  companies,
  companyUsers,
  users,
} from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InterviewVideoPanel } from '@/components/interviews/interview-video-panel'
import { InterviewFeedbackForm } from '@/components/interviews/interview-feedback-form'
import { TranscriptViewer } from '@/components/interviews/transcript-viewer'
import { RecordingPlayer } from '@/components/interviews/recording-player'
import { ErrorBoundary } from '@/components/error-boundary'
import { InterviewErrorFallback } from '@/components/interviews/interview-error-fallback'

export const metadata = {
  title: 'Interview Details | VerticalHire',
}

interface InterviewDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function InterviewDetailPage({ params }: InterviewDetailPageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id: interviewId } = await params

  const [companyUser] = await db
    .select({ companyId: companyUsers.companyId })
    .from(companyUsers)
    .where(eq(companyUsers.userId, session.user.id))
    .limit(1)

  if (!companyUser) redirect('/settings/company')

  const [interview] = await db
    .select({
      id: interviews.id,
      scheduledAt: interviews.scheduledAt,
      durationMinutes: interviews.durationMinutes,
      status: interviews.status,
      zoomMeetingId: interviews.zoomMeetingId,
      zoomJoinUrl: interviews.zoomJoinUrl,
      zoomStartUrl: interviews.zoomStartUrl,
      recordingUrl: interviews.recordingUrl,
      transcript: interviews.transcript,
      aiSummary: interviews.aiSummary,
      aiSentimentScore: interviews.aiSentimentScore,
      aiCompetencyScores: interviews.aiCompetencyScores,
      interviewQuestions: interviews.interviewQuestions,
      cancelReason: interviews.cancelReason,
      createdAt: interviews.createdAt,
      candidateId: candidates.id,
      candidateFirstName: candidates.firstName,
      candidateLastName: candidates.lastName,
      candidateEmail: candidates.email,
      candidateProfileImage: candidates.profileImageUrl,
      candidateTitle: candidates.currentTitle,
      jobId: jobs.id,
      jobTitle: jobs.title,
      companyName: companies.name,
    })
    .from(interviews)
    .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
    .leftJoin(jobs, eq(interviews.jobId, jobs.id))
    .innerJoin(companies, eq(interviews.companyId, companies.id))
    .where(
      and(eq(interviews.id, interviewId), eq(interviews.companyId, companyUser.companyId))
    )
    .limit(1)

  if (!interview) notFound()

  // Fetch feedback
  const feedbackList = await db
    .select({
      id: interviewFeedback.id,
      rating: interviewFeedback.rating,
      feedbackText: interviewFeedback.feedbackText,
      recommendation: interviewFeedback.recommendation,
      createdAt: interviewFeedback.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(interviewFeedback)
    .innerJoin(users, eq(interviewFeedback.userId, users.id))
    .where(eq(interviewFeedback.interviewId, interviewId))
    .orderBy(desc(interviewFeedback.createdAt))

  const candidateName = `${interview.candidateFirstName} ${interview.candidateLastName}`
  const candidateInitials = `${interview.candidateFirstName?.[0] || ''}${interview.candidateLastName?.[0] || ''}`.toUpperCase()
  const scheduledDate = new Date(interview.scheduledAt)
  const now = new Date()
  const isUpcoming = scheduledDate > now && interview.status === 'scheduled'
  const isLive = interview.status === 'in_progress'
  const isCompleted = interview.status === 'completed'

  const competencyScores = interview.aiCompetencyScores as {
    technical: number
    communication: number
    safety: number
    cultureFit: number
  } | null

  const questions = (interview.interviewQuestions as Array<{
    id: string
    question: string
    answer?: string
    completed: boolean
  }>) || []

  // Try to fetch enhanced analysis for key moments
  // Note: This would ideally come from the interview record if stored
  // For now, we'll pass empty array and rely on competency scores
  const keyMoments: Array<{
    timestamp: string
    quote: string
    significance: string
    sentiment: string
  }> = []

  // Transform competency scores for transcript viewer
  const competencyEvidence = competencyScores ? {
    technical: { score: competencyScores.technical, evidence: [] },
    communication: { score: competencyScores.communication, evidence: [] },
    safety: { score: competencyScores.safety, evidence: [] },
    cultureFit: { score: competencyScores.cultureFit, evidence: [] },
  } : undefined

  const recMap: Record<string, { label: string; color: string }> = {
    strong_hire: { label: 'Strong Hire', color: 'bg-green-100 text-green-800' },
    hire: { label: 'Hire', color: 'bg-emerald-100 text-emerald-800' },
    maybe: { label: 'Maybe', color: 'bg-yellow-100 text-yellow-800' },
    no_hire: { label: 'No Hire', color: 'bg-red-100 text-red-800' },
    strong_no_hire: { label: 'Strong No Hire', color: 'bg-red-200 text-red-900' },
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link href="/interviews">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Interviews
          </Button>
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Interview: {candidateName}
              </h1>
              <Badge
                className={
                  isLive
                    ? 'bg-red-100 text-red-800 animate-pulse'
                    : isCompleted
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                }
              >
                {isLive ? 'Live' : interview.status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {interview.jobTitle || 'General Interview'} &middot;{' '}
              {scheduledDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}{' '}
              at{' '}
              {scheduledDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          </div>

          <div className="flex gap-2">
            <Link href={`/candidates/${interview.candidateId}`}>
              <Button variant="outline" className="gap-2">
                <User className="h-4 w-4" />
                View Profile
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Video Panel - inspired by reference UI */}
      <InterviewVideoPanel
        interview={{
          id: interview.id,
          status: interview.status,
          scheduledAt: interview.scheduledAt.toISOString(),
          durationMinutes: interview.durationMinutes,
          zoomMeetingId: interview.zoomMeetingId,
          zoomJoinUrl: interview.zoomJoinUrl,
          zoomStartUrl: interview.zoomStartUrl,
          recordingUrl: interview.recordingUrl,
        }}
        candidateName={candidateName}
        candidateEmail={interview.candidateEmail || ''}
        candidateInitials={candidateInitials}
        interviewerName={session.user.name || session.user.email}
        interviewerEmail={session.user.email}
        isHost={true}
        questions={questions}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Summary */}
          {interview.aiSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-orange-500" />
                  AI Summary of Interview
                </CardTitle>
                <CardDescription>
                  Auto-generated analysis of the interview conversation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <p className="text-sm leading-relaxed">{interview.aiSummary}</p>
                </div>

                {interview.aiSentimentScore != null && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Overall Sentiment</span>
                      <span className="font-bold text-lg">
                        {interview.aiSentimentScore}/100
                      </span>
                    </div>
                    <Progress value={interview.aiSentimentScore} className="h-3" />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Competency Scores */}
          {competencyScores && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  Competency Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: 'technical', label: 'Technical Skills', color: 'bg-blue-500' },
                  { key: 'communication', label: 'Communication', color: 'bg-green-500' },
                  { key: 'safety', label: 'Safety Awareness', color: 'bg-orange-500' },
                  { key: 'cultureFit', label: 'Culture Fit', color: 'bg-purple-500' },
                ].map(({ key, label, color }) => {
                  const score = competencyScores[key as keyof typeof competencyScores]
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{label}</span>
                        <span className="font-semibold">{score}/100</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${color}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Recording Player with Synced Transcript */}
          {interview.recordingUrl && (
            <ErrorBoundary
              fallback={
                <InterviewErrorFallback
                  section="video"
                  onReset={() => window.location.reload()}
                />
              }
              resetKeys={[interview.recordingUrl]}
            >
              <RecordingPlayer
                recordingUrl={interview.recordingUrl}
                transcript={interview.transcript || undefined}
                keyMoments={keyMoments}
                duration={interview.durationMinutes ? interview.durationMinutes * 60 : undefined}
              />
            </ErrorBoundary>
          )}

          {/* Transcript Viewer (fallback if no recording) */}
          {interview.transcript && !interview.recordingUrl && (
            <ErrorBoundary
              fallback={
                <InterviewErrorFallback
                  section="transcript"
                  onReset={() => window.location.reload()}
                />
              }
              resetKeys={[interview.transcript]}
            >
              <TranscriptViewer
                transcript={interview.transcript}
                keyMoments={keyMoments}
                competencyScores={competencyEvidence}
              />
            </ErrorBoundary>
          )}

          {/* Feedback Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Existing Feedback */}
              {feedbackList.length > 0 && (
                <div className="space-y-4">
                  {feedbackList.map((fb) => (
                    <div key={fb.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{fb.userName || fb.userEmail}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{fb.rating}/10</span>
                          {fb.recommendation && recMap[fb.recommendation] && (
                            <Badge className={recMap[fb.recommendation].color}>
                              {recMap[fb.recommendation].label}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {fb.feedbackText && (
                        <p className="text-sm text-muted-foreground">{fb.feedbackText}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {fb.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              {/* Add Feedback Form */}
              <InterviewFeedbackForm interviewId={interview.id} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Interview Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Interview Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {scheduledDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {scheduledDate.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  ({interview.durationMinutes} min)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <Link
                  href={`/candidates/${interview.candidateId}`}
                  className="text-blue-600 hover:underline"
                >
                  {candidateName}
                </Link>
              </div>
              {interview.jobTitle && (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <Link
                    href={`/jobs/${interview.jobId}`}
                    className="text-blue-600 hover:underline"
                  >
                    {interview.jobTitle}
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recording Download (only if recording exists, player is shown in main content) */}
          {interview.recordingUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Video className="h-4 w-4 text-red-500" />
                  Recording
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-3">View the recording with synced transcript in the main area</p>
                <a
                  href={interview.recordingUrl}
                  download
                >
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <Video className="h-4 w-4" />
                    Download
                  </Button>
                </a>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!isCompleted && (
                <Button variant="outline" className="w-full gap-2" asChild>
                  <Link href={`/candidates/${interview.candidateId}`}>
                    <User className="h-4 w-4" />
                    View Candidate Profile
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
