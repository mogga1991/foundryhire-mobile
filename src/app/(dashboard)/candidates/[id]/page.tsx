import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft,
  Mail,
  Phone,
  Linkedin,
  MapPin,
  Briefcase,
  Calendar,
  Clock,
  Copy,
  ExternalLink,
  UserPlus,
  MessageSquare,
  FileText,
  CheckCircle2,
  Award,
  Building2,
  TrendingUp,
  Shield,
  Zap,
  Activity,
  GraduationCap,
  BadgeCheck,
} from 'lucide-react'
import { ScheduleInterviewButton } from '@/components/candidates/schedule-interview-button'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  candidates,
  jobs,
  companyUsers,
  candidateActivities,
  campaignSends,
  campaigns,
  interviews,
} from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { OfferExpiryControls } from '@/components/interviews/offer-expiry-controls'

export const metadata = {
  title: 'Candidate Profile | VerticalHire',
  description: 'View detailed candidate information',
}

const stageColors: Record<string, string> = {
  sourced: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  screening: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  interview: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  offer: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  hired: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const stageLabels: Record<string, string> = {
  sourced: 'Sourced',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
}

interface CandidateDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function CandidateDetailPage({ params }: CandidateDetailPageProps) {
  const session = await getSession({ allowGuest: true })

  if (!session) {
    redirect('/login')
  }

  const user = session.user
  const { id: candidateId } = await params

  // Get the user's company
  const [companyUser] = await db
    .select({ companyId: companyUsers.companyId })
    .from(companyUsers)
    .where(eq(companyUsers.userId, user.id))
    .limit(1)

  if (!companyUser) {
    redirect('/settings/company')
  }

  // Fetch candidate with job details
  const [candidate] = await db
    .select({
      id: candidates.id,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      email: candidates.email,
      phone: candidates.phone,
      linkedinUrl: candidates.linkedinUrl,
      githubUrl: candidates.githubUrl,
      portfolioUrl: candidates.portfolioUrl,
      currentTitle: candidates.currentTitle,
      currentCompany: candidates.currentCompany,
      location: candidates.location,
      experienceYears: candidates.experienceYears,
      skills: candidates.skills,
      resumeUrl: candidates.resumeUrl,
      resumeText: candidates.resumeText,
      coverLetter: candidates.coverLetter,
      source: candidates.source,
      status: candidates.status,
      stage: candidates.stage,
      aiScore: candidates.aiScore,
      aiScoreBreakdown: candidates.aiScoreBreakdown,
      aiSummary: candidates.aiSummary,
      notes: candidates.notes,
      appliedAt: candidates.appliedAt,
      emailVerified: candidates.emailVerified,
      emailDeliverability: candidates.emailDeliverability,
      phoneVerified: candidates.phoneVerified,
      phoneType: candidates.phoneType,
      enrichmentScore: candidates.enrichmentScore,
      dataCompleteness: candidates.dataCompleteness,
      enrichedAt: candidates.enrichedAt,
      verifiedAt: candidates.verifiedAt,
      enrichmentSource: candidates.enrichmentSource,
      socialProfiles: candidates.socialProfiles,
      companyInfo: candidates.companyInfo,
      profileImageUrl: candidates.profileImageUrl,
      headline: candidates.headline,
      about: candidates.about,
      experience: candidates.experience,
      education: candidates.education,
      certifications: candidates.certifications,
      linkedinScrapedAt: candidates.linkedinScrapedAt,
      createdAt: candidates.createdAt,
      updatedAt: candidates.updatedAt,
      jobId: candidates.jobId,
      jobTitle: jobs.title,
    })
    .from(candidates)
    .leftJoin(jobs, eq(candidates.jobId, jobs.id))
    .where(and(eq(candidates.id, candidateId), eq(candidates.companyId, companyUser.companyId)))
    .limit(1)

  if (!candidate) {
    notFound()
  }

  // Fetch activities
  const activities = await db
    .select({
      id: candidateActivities.id,
      activityType: candidateActivities.activityType,
      title: candidateActivities.title,
      description: candidateActivities.description,
      metadata: candidateActivities.metadata,
      createdAt: candidateActivities.createdAt,
    })
    .from(candidateActivities)
    .where(eq(candidateActivities.candidateId, candidateId))
    .orderBy(desc(candidateActivities.createdAt))
    .limit(20)

  // Fetch email campaign history
  const emailHistory = await db
    .select({
      id: campaignSends.id,
      campaignName: campaigns.name,
      status: campaignSends.status,
      sentAt: campaignSends.sentAt,
      openedAt: campaignSends.openedAt,
      clickedAt: campaignSends.clickedAt,
      repliedAt: campaignSends.repliedAt,
      bouncedAt: campaignSends.bouncedAt,
    })
    .from(campaignSends)
    .leftJoin(campaigns, eq(campaignSends.campaignId, campaigns.id))
    .where(eq(campaignSends.candidateId, candidateId))
    .orderBy(desc(campaignSends.sentAt))
    .limit(10)

  const [latestInterview] = await db
    .select({
      id: interviews.id,
      scheduledAt: interviews.scheduledAt,
      candidatePortalExpiresAt: interviews.candidatePortalExpiresAt,
      status: interviews.status,
    })
    .from(interviews)
    .where(
      and(
        eq(interviews.candidateId, candidateId),
        eq(interviews.companyId, companyUser.companyId)
      )
    )
    .orderBy(desc(interviews.scheduledAt))
    .limit(1)

  const fullName = `${candidate.firstName} ${candidate.lastName}`.trim()
  const initials =
    candidate.firstName && candidate.lastName
      ? (candidate.firstName[0] + candidate.lastName[0]).toUpperCase()
      : fullName.slice(0, 2).toUpperCase() || '??'

  const stageColor = stageColors[candidate.stage] || stageColors.sourced
  const stageLabel = stageLabels[candidate.stage] || candidate.stage

  // Parse AI score breakdown
  const scoreBreakdown = candidate.aiScoreBreakdown as any

  // Parse JSONB fields for rich profile data
  const experienceList = Array.isArray(candidate.experience) ? (candidate.experience as any[]) : []
  const educationList = Array.isArray(candidate.education) ? (candidate.education as any[]) : []
  const certificationsList = Array.isArray(candidate.certifications) ? (candidate.certifications as any[]) : []

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link href="/candidates">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Candidates
          </Button>
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          {/* Left: Profile Info */}
          <div className="flex gap-6">
            <div className="relative h-20 w-20 shrink-0 rounded-full overflow-hidden bg-primary/10">
              {candidate.profileImageUrl ? (
                <Image
                  src={candidate.profileImageUrl}
                  alt={fullName}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex items-center justify-center h-full w-full bg-primary text-primary-foreground text-2xl font-medium">
                  {initials}
                </div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight mb-1">{fullName}</h1>
              {candidate.headline && (
                <p className="text-base text-muted-foreground mb-2">{candidate.headline}</p>
              )}
              <div className="flex flex-wrap gap-3 text-muted-foreground mb-3">
                {candidate.currentTitle && (
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4" />
                    <span>{candidate.currentTitle}</span>
                  </div>
                )}
                {candidate.currentCompany && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4" />
                    <span>{candidate.currentCompany}</span>
                  </div>
                )}
                {candidate.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    <span>{candidate.location}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={stageColor}>{stageLabel}</Badge>
                {candidate.aiScore && (
                  <Badge variant="outline" className="gap-1">
                    <Award className="h-3 w-3" />
                    {candidate.aiScore}% Match
                  </Badge>
                )}
                {candidate.emailVerified && (
                  <Badge variant="outline" className="gap-1 text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified Email
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button className="gap-2">
              <Mail className="h-4 w-4" />
              Send Email
            </Button>
            <Button variant="outline" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add to Campaign
            </Button>
            <ScheduleInterviewButton
              candidateId={candidate.id}
              candidateName={fullName}
              jobId={candidate.jobId}
              companyId={companyUser.companyId}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content - Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Email</div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{candidate.email || <span className="text-muted-foreground/50 italic">Pending enrichment</span>}</span>
                    {candidate.email && candidate.emailVerified && (
                      <Badge variant="outline" className="text-green-600 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                    {candidate.email && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto">
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {candidate.emailDeliverability && (
                    <div className="text-xs text-muted-foreground">
                      Deliverability: {candidate.emailDeliverability}
                    </div>
                  )}
                </div>

                {candidate.phone && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Phone</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{candidate.phone}</span>
                      {candidate.phoneVerified && (
                        <Badge variant="outline" className="text-green-600 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Verified
                        </Badge>
                      )}
                      <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto">
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    {candidate.phoneType && (
                      <div className="text-xs text-muted-foreground">Type: {candidate.phoneType}</div>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              <div className="grid gap-3 sm:grid-cols-2">
                {candidate.linkedinUrl && (
                  <a
                    href={candidate.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    <Linkedin className="h-4 w-4" />
                    LinkedIn Profile
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {candidate.githubUrl && (
                  <a
                    href={candidate.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    GitHub Profile
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {candidate.portfolioUrl && (
                  <a
                    href={candidate.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    Portfolio
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <Separator />

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Source: {candidate.source || 'Unknown'}
                </div>
                {candidate.enrichmentSource && (
                  <div className="flex items-center gap-1">
                    Enriched via: {candidate.enrichmentSource}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Professional Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Professional Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                {candidate.experienceYears !== null && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Experience</div>
                    <div className="text-2xl font-bold">{candidate.experienceYears} years</div>
                  </div>
                )}
                {candidate.currentTitle && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Current Role</div>
                    <div className="font-semibold">{candidate.currentTitle}</div>
                  </div>
                )}
                {candidate.currentCompany && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Current Company</div>
                    <div className="font-semibold">{candidate.currentCompany}</div>
                  </div>
                )}
              </div>

              {candidate.about && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="text-sm font-medium">About</div>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{String(candidate.about)}</p>
                  </div>
                </>
              )}

              {candidate.aiSummary && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="text-sm font-medium">AI-Generated Summary</div>
                    <p className="text-sm text-muted-foreground">{candidate.aiSummary}</p>
                  </div>
                </>
              )}

              {candidate.skills && candidate.skills.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Skills</div>
                    <div className="flex flex-wrap gap-2">
                      {candidate.skills.map((skill, index) => (
                        <Badge key={index} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {candidate.jobTitle && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Applied For</div>
                    <Link href={`/jobs/${candidate.jobId}`} className="text-sm text-blue-600 hover:underline">
                      {candidate.jobTitle}
                    </Link>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Work Experience Card */}
          {experienceList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Work Experience
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {experienceList.map((exp: any, index: number) => (
                    <div key={index} className="relative pl-6 border-l-2 border-muted pb-1">
                      <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-primary bg-background" />
                      <div className="space-y-1">
                        <div className="font-semibold text-sm">{exp.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {exp.company}
                          {exp.location && <span> &middot; {exp.location}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {exp.startDate && <span>{exp.startDate}</span>}
                          {exp.startDate && <span> &ndash; </span>}
                          {exp.isCurrent ? <span className="text-green-600 font-medium">Present</span> : (exp.endDate && <span>{exp.endDate}</span>)}
                          {exp.duration && <span> &middot; {exp.duration}</span>}
                        </div>
                        {exp.description && (
                          <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">{exp.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Education Card */}
          {educationList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Education
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {educationList.map((edu: any, index: number) => (
                    <div key={index} className="space-y-1">
                      <div className="font-semibold text-sm">{edu.school}</div>
                      {(edu.degree || edu.fieldOfStudy) && (
                        <div className="text-sm text-muted-foreground">
                          {edu.degree}
                          {edu.degree && edu.fieldOfStudy && ', '}
                          {edu.fieldOfStudy}
                        </div>
                      )}
                      {(edu.startDate || edu.endDate) && (
                        <div className="text-xs text-muted-foreground">
                          {edu.startDate}
                          {edu.startDate && edu.endDate && ' - '}
                          {edu.endDate}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Certifications Card */}
          {certificationsList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5" />
                  Certifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {certificationsList.map((cert: any, index: number) => (
                    <div key={index} className="space-y-0.5">
                      <div className="font-semibold text-sm">{cert.name}</div>
                      {cert.issuingOrganization && (
                        <div className="text-sm text-muted-foreground">{cert.issuingOrganization}</div>
                      )}
                      {cert.issueDate && (
                        <div className="text-xs text-muted-foreground">Issued: {cert.issueDate}</div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Match Analysis Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Match Analysis
              </CardTitle>
              <CardDescription>AI-powered candidate evaluation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Match Score */}
              {candidate.aiScore && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Overall Match Score</span>
                    <span className="text-2xl font-bold text-primary">{candidate.aiScore}%</span>
                  </div>
                  <Progress value={candidate.aiScore} className="h-3" />
                </div>
              )}

              {/* Score Breakdown */}
              {scoreBreakdown && (
                <div className="space-y-3">
                  <div className="text-sm font-medium">Score Breakdown</div>
                  <div className="grid gap-3">
                    {Object.entries(scoreBreakdown).map(([key, value]: [string, any]) => (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span className="font-semibold">{value}%</span>
                        </div>
                        <Progress value={value as number} className="h-2" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Data Completeness */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Data Completeness</span>
                  <span className="font-semibold">{candidate.dataCompleteness || 0}%</span>
                </div>
                <Progress value={candidate.dataCompleteness || 0} className="h-2" />
              </div>

              {/* Enrichment Score */}
              {candidate.enrichmentScore !== null && candidate.enrichmentScore > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Enrichment Quality</span>
                    <span className="font-semibold">{candidate.enrichmentScore}%</span>
                  </div>
                  <Progress value={candidate.enrichmentScore} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes & History Section */}
          <Card>
            <CardHeader>
              <CardTitle>Notes & History</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="notes" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  <TabsTrigger value="emails">Emails</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>

                <TabsContent value="notes" className="space-y-4">
                  <Textarea
                    placeholder="Add a note about this candidate..."
                    className="min-h-[120px]"
                    defaultValue={candidate.notes || ''}
                  />
                  <Button className="gap-2">
                    <FileText className="h-4 w-4" />
                    Save Note
                  </Button>
                </TabsContent>

                <TabsContent value="emails" className="space-y-4">
                  {emailHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Mail className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>No emails sent yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {emailHistory.map((email) => (
                        <div key={email.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="font-semibold">{email.campaignName}</div>
                            <Badge
                              variant={
                                email.status === 'sent'
                                  ? 'default'
                                  : email.status === 'failed'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                            >
                              {email.status}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            {email.sentAt && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Sent {email.sentAt.toLocaleDateString()}
                              </span>
                            )}
                            {email.openedAt && (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="h-3 w-3" />
                                Opened
                              </span>
                            )}
                            {email.clickedAt && (
                              <span className="flex items-center gap-1 text-blue-600">
                                <ExternalLink className="h-3 w-3" />
                                Clicked
                              </span>
                            )}
                            {email.repliedAt && (
                              <span className="flex items-center gap-1 text-purple-600">
                                <MessageSquare className="h-3 w-3" />
                                Replied
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="activity" className="space-y-4">
                  {activities.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>No activity yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activities.map((activity) => (
                        <div key={activity.id} className="flex gap-3 border-l-2 border-muted pl-4 pb-4">
                          <div className="flex-1 space-y-1">
                            <div className="font-semibold text-sm">{activity.title}</div>
                            {activity.description && (
                              <p className="text-sm text-muted-foreground">{activity.description}</p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {activity.createdAt.toLocaleDateString()} at{' '}
                              {activity.createdAt.toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar (1/3) */}
        <div className="space-y-6">
          {/* Activity Timeline Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <UserPlus className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">Candidate Added</div>
                    <div className="text-xs text-muted-foreground">
                      {candidate.createdAt.toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {candidate.enrichedAt != null && (
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                      <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">Profile Enriched</div>
                      <div className="text-xs text-muted-foreground">
                        {candidate.enrichedAt.toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                )}

                {candidate.verifiedAt != null && (
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">Contact Verified</div>
                      <div className="text-xs text-muted-foreground">
                        {candidate.verifiedAt.toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                )}

                {emailHistory.length > 0 && emailHistory[0].sentAt != null && (
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">Last Email Sent</div>
                      <div className="text-xs text-muted-foreground">
                        {emailHistory[0].sentAt.toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Change Status</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue={candidate.stage}
                >
                  <option value="sourced">Sourced</option>
                  <option value="screening">Screening</option>
                  <option value="interview">Interview</option>
                  <option value="offer">Offer</option>
                  <option value="hired">Hired</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium">Add to Job</label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select a job...</option>
                  {candidate.jobTitle && <option value={candidate.jobId || ''}>{candidate.jobTitle}</option>}
                </select>
              </div>

              <Separator />

              <ScheduleInterviewButton
                candidateId={candidate.id}
                candidateName={fullName}
                jobId={candidate.jobId}
                companyId={companyUser.companyId}
                variant="outline"
                className="w-full gap-2"
              />

              {latestInterview && (
                <OfferExpiryControls
                  interviewId={latestInterview.id}
                  candidateName={fullName}
                  currentExpiresAt={latestInterview.candidatePortalExpiresAt?.toISOString() || null}
                />
              )}

              <Button variant="outline" className="w-full gap-2">
                <FileText className="h-4 w-4" />
                Add Note
              </Button>
            </CardContent>
          </Card>

          {/* Company Info (if available) */}
          {candidate.companyInfo != null && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {(candidate.companyInfo as any).name && (
                    <div>
                      <div className="text-muted-foreground">Company</div>
                      <div className="font-semibold">{(candidate.companyInfo as any).name}</div>
                    </div>
                  )}
                  {(candidate.companyInfo as any).industry && (
                    <div>
                      <div className="text-muted-foreground">Industry</div>
                      <div>{(candidate.companyInfo as any).industry}</div>
                    </div>
                  )}
                  {(candidate.companyInfo as any).size && (
                    <div>
                      <div className="text-muted-foreground">Company Size</div>
                      <div>{(candidate.companyInfo as any).size}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
