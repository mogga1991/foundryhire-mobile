import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Clock, Video } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CandidateNav } from '@/components/candidate/candidate-nav'
import { getCandidateUser } from '@/lib/auth/get-candidate-user'
import { getCandidateWorkspaceData } from '@/lib/services/candidate-workspace'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Interviews - Candidate Workspace',
  description: 'View and join your interview opportunities',
}

export default async function CandidateInterviewsPage() {
  const user = await getCandidateUser()
  if (!user) {
    redirect('/portal/login')
  }

  const workspace = await getCandidateWorkspaceData({
    candidateUserId: user.id,
    candidateEmail: user.email,
  })

  return (
    <>
      <CandidateNav user={user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Interviews</h1>
          <p className="text-gray-600 mt-2">Join interviews and track scheduling updates.</p>
        </div>

        <div className="space-y-4">
          {workspace.opportunities.length === 0 && (
            <Card className="border-orange-200">
              <CardContent className="p-6">
                <p className="text-sm text-gray-600">No interviews available yet.</p>
              </CardContent>
            </Card>
          )}

          {workspace.opportunities.map((item) => (
            <Card key={item.interviewId} className="border-orange-200">
              <CardHeader>
                <CardTitle className="text-lg">{item.companyName} {item.jobTitle ? `• ${item.jobTitle}` : ''}</CardTitle>
                <CardDescription>
                  {item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : 'Scheduling in progress'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Badge variant="secondary" className="capitalize">{item.lifecycleStatus.replace('_', ' ')}</Badge>
                  {item.expiresAt && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Expires {new Date(item.expiresAt).toLocaleString()}
                    </span>
                  )}
                  {item.aiSentimentScore !== null && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Video className="h-4 w-4" />
                      Interview insight score {item.aiSentimentScore}
                    </span>
                  )}
                </div>

                {item.portalToken && (
                  <Link
                    href={`/portal/${item.portalToken}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-orange-700 hover:text-orange-800 mt-4"
                  >
                    Open interview workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </>
  )
}
