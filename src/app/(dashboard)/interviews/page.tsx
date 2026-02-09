import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, Calendar } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { interviews, candidates, jobs, companyUsers } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { InterviewCalendar } from '@/components/interviews/interview-calendar'

export const metadata = {
  title: 'Interviews | VerticalHire',
  description: 'Manage all scheduled and completed interviews',
}

export default async function InterviewsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [companyUser] = await db
    .select({ companyId: companyUsers.companyId })
    .from(companyUsers)
    .where(eq(companyUsers.userId, session.user.id))
    .limit(1)

  if (!companyUser) redirect('/settings/company')

  const interviewList = await db
    .select({
      id: interviews.id,
      scheduledAt: interviews.scheduledAt,
      durationMinutes: interviews.durationMinutes,
      status: interviews.status,
      interviewType: interviews.interviewType,
      location: interviews.location,
      phoneNumber: interviews.phoneNumber,
      aiSummary: interviews.aiSummary,
      aiSentimentScore: interviews.aiSentimentScore,
      candidateFirstName: candidates.firstName,
      candidateLastName: candidates.lastName,
      candidateId: candidates.id,
      candidateAiScore: candidates.aiScore,
      candidateEnrichmentScore: candidates.enrichmentScore,
      candidateDataCompleteness: candidates.dataCompleteness,
      candidateResumeUrl: candidates.resumeUrl,
      candidateLinkedinUrl: candidates.linkedinUrl,
      candidateSkills: candidates.skills,
      candidateExperienceYears: candidates.experienceYears,
      candidateCurrentTitle: candidates.currentTitle,
      jobTitle: jobs.title,
      jobId: jobs.id,
      jobSkillsRequired: jobs.skillsRequired,
    })
    .from(interviews)
    .leftJoin(candidates, eq(interviews.candidateId, candidates.id))
    .leftJoin(jobs, eq(interviews.jobId, jobs.id))
    .where(eq(interviews.companyId, companyUser.companyId))
    .orderBy(desc(interviews.scheduledAt))
    .limit(100)

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const upcoming = interviewList.filter(
    (i) => (i.status === 'scheduled' || i.status === 'confirmed' || i.status === 'pending') && new Date(i.scheduledAt) > now
  )
  const today = interviewList.filter(
    (i) => new Date(i.scheduledAt) >= todayStart && new Date(i.scheduledAt) < new Date(todayStart.getTime() + 86400000)
  )

  const avgScore = interviewList.reduce((sum, i) => sum + (i.candidateAiScore || 0), 0) / (interviewList.filter(i => i.candidateAiScore).length || 1)
  const highScoreCandidates = interviewList.filter(i => (i.candidateAiScore || 0) >= 80).length

  const stats = {
    total: interviewList.length,
    today: today.length,
    upcoming: upcoming.length,
    completed: interviewList.filter(i => i.status === 'completed').length,
    avgScore: Math.round(avgScore),
    highScore: highScoreCandidates,
  }

  return (
    <div className="bg-slate-50">
      {/* Enterprise Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 mb-1">Interview Pipeline</h1>
              <p className="text-sm text-slate-600">Real-time candidate evaluation and scheduling</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/candidates">
                <Button variant="outline" className="border-slate-300">
                  <Users className="mr-2 h-4 w-4" />
                  View All Candidates
                </Button>
              </Link>
            </div>
          </div>

          {/* KPI Bar */}
          <div className="grid grid-cols-6 gap-4">
            <div className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
              <div className="text-xs font-medium text-slate-600 mb-1">Total Scheduled</div>
              <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            </div>
            <div className="bg-blue-50 rounded-lg px-4 py-3 border border-blue-200">
              <div className="text-xs font-medium text-blue-700 mb-1">Today</div>
              <div className="text-2xl font-bold text-blue-900">{stats.today}</div>
            </div>
            <div className="bg-orange-50 rounded-lg px-4 py-3 border border-orange-200">
              <div className="text-xs font-medium text-orange-700 mb-1">Upcoming</div>
              <div className="text-2xl font-bold text-orange-900">{stats.upcoming}</div>
            </div>
            <div className="bg-green-50 rounded-lg px-4 py-3 border border-green-200">
              <div className="text-xs font-medium text-green-700 mb-1">Completed</div>
              <div className="text-2xl font-bold text-green-900">{stats.completed}</div>
            </div>
            <div className="bg-purple-50 rounded-lg px-4 py-3 border border-purple-200">
              <div className="text-xs font-medium text-purple-700 mb-1">Avg Match Score</div>
              <div className="text-2xl font-bold text-purple-900">{stats.avgScore}%</div>
            </div>
            <div className="bg-emerald-50 rounded-lg px-4 py-3 border border-emerald-200">
              <div className="text-xs font-medium text-emerald-700 mb-1">Top Candidates</div>
              <div className="text-2xl font-bold text-emerald-900">{stats.highScore}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        <InterviewCalendar interviews={upcoming} />
      </div>
    </div>
  )
}
