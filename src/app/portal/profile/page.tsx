import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCandidateUser } from '@/lib/auth/get-candidate-user'
import { CandidateNav } from '@/components/candidate/candidate-nav'
import { CandidateProfileForm } from '@/components/candidate/profile/candidate-profile-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My Profile - VerticalHire Candidate',
  description: 'Manage your professional profile and credentials',
}

export default async function CandidateProfilePage() {
  const user = await getCandidateUser()

  if (!user) {
    redirect('/portal/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      <CandidateNav user={user} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-600 mt-2">
            Keep your profile up to date to attract the best opportunities
          </p>
        </div>

        <CandidateProfileForm user={user} />
      </main>
    </div>
  )
}
