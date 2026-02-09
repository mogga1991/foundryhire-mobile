import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Briefcase, Calendar, Clock, User } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getCandidateUser } from '@/lib/auth/get-candidate-user'
import { CandidateNav } from '@/components/candidate/candidate-nav'

export const metadata: Metadata = {
  title: 'Dashboard - VerticalHire Candidate',
  description: 'View your job applications and opportunities',
}

export default async function CandidateDashboardPage() {
  const user = await getCandidateUser()

  if (!user) {
    redirect('/candidate/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      <CandidateNav user={user} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Message */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">
            Welcome back, {user.firstName}! 👋
          </h2>
          <p className="text-gray-600 mt-2">
            Here's an overview of your construction career opportunities
          </p>
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-orange-200 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Profile Completeness
              </CardTitle>
              <User className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {(() => {
                  let completed = 2 // firstName and lastName always exist
                  if (user.phone) completed++
                  if (user.location) completed++
                  if (user.currentTitle) completed++
                  if (user.currentCompany) completed++
                  if (user.experienceYears) completed++
                  if (user.linkedinUrl) completed++
                  if (user.bio) completed++
                  if (user.skills && user.skills.length > 0) completed++
                  if (user.resumeUrl) completed++
                  const percentage = Math.round((completed / 11) * 100)
                  return `${percentage}%`
                })()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {user.resumeUrl ? 'Resume uploaded' : 'Add resume to improve'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Employer Reach-outs
              </CardTitle>
              <Briefcase className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                No invitations yet
              </p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Interviews Scheduled
              </CardTitle>
              <Calendar className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                No interviews scheduled
              </p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Experience
              </CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {user.experienceYears || 0} yrs
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {user.currentTitle || 'Update your profile'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Getting Started / Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-orange-200 shadow-md">
            <CardHeader>
              <CardTitle className="text-orange-900">Complete Your Profile</CardTitle>
              <CardDescription>Stand out to employers by completing your profile</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!user.resumeUrl && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <Briefcase className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm text-orange-900">Upload Your Resume</h4>
                      <p className="text-xs text-muted-foreground">Let employers see your experience</p>
                    </div>
                  </div>
                )}

                {!user.bio && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <User className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm text-orange-900">Add a Professional Bio</h4>
                      <p className="text-xs text-muted-foreground">Describe your experience and specialties</p>
                    </div>
                  </div>
                )}

                {(!user.skills || user.skills.length === 0) && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <Briefcase className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm text-orange-900">List Your Skills</h4>
                      <p className="text-xs text-muted-foreground">Help employers find you for the right roles</p>
                    </div>
                  </div>
                )}

                {!user.currentTitle && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <Briefcase className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm text-orange-900">Add Your Current Role</h4>
                      <p className="text-xs text-muted-foreground">Show your current position and company</p>
                    </div>
                  </div>
                )}

                {user.resumeUrl && user.bio && user.skills && user.skills.length > 0 && user.currentTitle && (
                  <div className="text-center py-8">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
                      <svg
                        className="h-8 w-8 text-green-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <h4 className="font-semibold text-orange-900">Profile Complete!</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      You're all set. Employers can now discover your profile.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 shadow-md">
            <CardHeader>
              <CardTitle className="text-orange-900">How It Works</CardTitle>
              <CardDescription>Your path to construction opportunities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-semibold text-sm flex-shrink-0">
                    1
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-gray-900">Complete Your Profile</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add your experience, skills, and resume to help employers find you
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-semibold text-sm flex-shrink-0">
                    2
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-gray-900">Get Discovered</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Employers search for candidates and review profiles that match their needs
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-semibold text-sm flex-shrink-0">
                    3
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-gray-900">Receive Invitations</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Employers will reach out directly with job opportunities
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-semibold text-sm flex-shrink-0">
                    4
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-gray-900">Start Interviewing</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Connect with employers and schedule interviews for positions you're interested in
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
