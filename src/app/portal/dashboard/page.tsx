import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getCandidateUser } from '@/lib/auth/get-candidate-user'
import { CandidateNav } from '@/components/candidate/candidate-nav'
import { getCandidateWorkspaceData } from '@/lib/services/candidate-workspace'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Workspace - VerticalHire Candidate',
  description: 'Manage your active interview workspaces, documents, offers, and onboarding tasks',
}

export default async function CandidateDashboardPage() {
  const user = await getCandidateUser()

  if (!user) {
    redirect('/portal/login')
  }

  const workspace = await getCandidateWorkspaceData({
    candidateUserId: user.id,
    candidateEmail: user.email,
  })

  const activeCount = workspace.opportunities.filter((item) => item.lifecycleStatus !== 'expired').length
  const interviewingCount = workspace.opportunities.filter((item) => item.lifecycleStatus === 'interviewing').length
  const offeredCount = workspace.opportunities.filter((item) => item.lifecycleStatus === 'offered').length

  return (
    <>
      <CandidateNav user={user} />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">
            Candidate Workspace
          </h2>
          <p className="text-gray-600 mt-2">
            Invitation-only access for interviews, documents, offers, and onboarding.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-orange-200 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Workspaces
              </CardTitle>
              <Briefcase className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{activeCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all companies and roles</p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Interviewing
              </CardTitle>
              <Calendar className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{interviewingCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Confirmed or in-progress interviews</p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Offers
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{offeredCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Review and accept before expiry</p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Unread Messages
              </CardTitle>
              <Mail className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{workspace.unreadReachOutCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {workspace.totalReachOutCount} total employer reach-outs
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-orange-200 shadow-md">
            <CardHeader>
              <CardTitle className="text-orange-900">Next Actions</CardTitle>
              <CardDescription>Fast path to keep your opportunity moving</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Link
                  href="/portal/interviews"
                  className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-200 hover:bg-orange-100 transition"
                >
                  <div>
                    <h4 className="font-semibold text-sm text-orange-900">Join Interviews</h4>
                    <p className="text-xs text-muted-foreground">Access your live and upcoming interviews</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-orange-700" />
                </Link>

                <Link
                  href="/portal/documents"
                  className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-200 hover:bg-orange-100 transition"
                >
                  <div>
                    <h4 className="font-semibold text-sm text-orange-900">Upload Required Documents</h4>
                    <p className="text-xs text-muted-foreground">Resume, licenses, and role-specific files</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-orange-700" />
                </Link>

                <Link
                  href="/portal/offers"
                  className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-200 hover:bg-orange-100 transition"
                >
                  <div>
                    <h4 className="font-semibold text-sm text-orange-900">Review Offers</h4>
                    <p className="text-xs text-muted-foreground">Track countdown and accept before expiration</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-orange-700" />
                </Link>

                <Link
                  href="/portal/onboarding"
                  className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-200 hover:bg-orange-100 transition"
                >
                  <div>
                    <h4 className="font-semibold text-sm text-orange-900">Complete Onboarding</h4>
                    <p className="text-xs text-muted-foreground">Submit required forms and final docs</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-orange-700" />
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 shadow-md">
            <CardHeader>
              <CardTitle className="text-orange-900">Current Opportunities</CardTitle>
              <CardDescription>Temporary, invitation-only workspaces</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {workspace.opportunities.length === 0 && (
                  <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50 p-4">
                    <p className="text-sm text-orange-900 font-medium">No active opportunities yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      You will see invites and interviews here as soon as an employer reaches out.
                    </p>
                  </div>
                )}

                {workspace.opportunities.slice(0, 4).map((item) => (
                  <div key={item.interviewId} className="rounded-lg border border-orange-200 p-3 bg-white">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {item.companyName} {item.jobTitle ? `• ${item.jobTitle}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : 'Schedule pending'}
                        </p>
                      </div>
                      <Badge variant="secondary" className="capitalize">
                        {item.lifecycleStatus.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      {item.aiScore !== null && (
                        <span className="inline-flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Match score: {item.aiScore}
                        </span>
                      )}
                      {item.expiresAt && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          Expires: {new Date(item.expiresAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {item.portalToken && (
                      <div className="mt-3">
                        <Link
                          href={`/portal/${item.portalToken}`}
                          className="inline-flex items-center text-xs font-medium text-orange-700 hover:text-orange-800"
                        >
                          Open workspace
                          <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                ))}

                <div className="pt-2">
                  <Link
                    href="/portal/interviews"
                    className="inline-flex items-center gap-2 text-sm font-medium text-orange-700 hover:text-orange-800"
                  >
                    View all opportunities
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-orange-200 shadow-md mt-6">
          <CardHeader>
            <CardTitle className="text-orange-900">How This Candidate Workspace Works</CardTitle>
            <CardDescription>Simple, secure, and time-boxed by design</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-4">
                <h4 className="font-semibold text-sm text-orange-900">Invitation-Only</h4>
                <p className="text-xs text-muted-foreground mt-2">
                  Employers invite candidates directly after sourcing and qualification.
                </p>
              </div>
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-4">
                <h4 className="font-semibold text-sm text-orange-900">Action Focused</h4>
                <p className="text-xs text-muted-foreground mt-2">
                  Interviews, documents, offers, and onboarding tasks are centralized in one place.
                </p>
              </div>
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-4">
                <h4 className="font-semibold text-sm text-orange-900">Time-Bound Access</h4>
                <p className="text-xs text-muted-foreground mt-2">
                  Workspaces expire automatically based on interview and offer lifecycle rules.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  )
}
