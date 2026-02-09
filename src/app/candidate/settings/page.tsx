import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCandidateUser } from '@/lib/auth/get-candidate-user'
import { CandidateNav } from '@/components/candidate/candidate-nav'
import { CandidateSettingsForm } from '@/components/candidate/settings/candidate-settings-form'

export const metadata: Metadata = {
  title: 'Settings - VerticalHire Candidate',
  description: 'Manage your account settings and preferences',
}

export default async function CandidateSettingsPage() {
  const user = await getCandidateUser()

  if (!user) {
    redirect('/candidate/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      <CandidateNav user={user} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">
            Manage your account settings and preferences
          </p>
        </div>

        <CandidateSettingsForm user={user} />
      </main>
    </div>
  )
}
