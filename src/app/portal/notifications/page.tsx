import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCandidateUser } from '@/lib/auth/get-candidate-user'
import { CandidateNav } from '@/components/candidate/candidate-nav'
import { CandidateNotificationsList } from '@/components/candidate/notifications/candidate-notifications-list'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Notifications - VerticalHire Candidate',
  description: 'View messages and opportunities from employers',
}

export default async function CandidateNotificationsPage() {
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
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600 mt-2">
            Messages and opportunities from employers
          </p>
        </div>

        <CandidateNotificationsList candidateId={user.id} />
      </main>
    </div>
  )
}
