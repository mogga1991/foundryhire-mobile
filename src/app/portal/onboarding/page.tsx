import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CandidateNav } from '@/components/candidate/candidate-nav'
import { getCandidateUser } from '@/lib/auth/get-candidate-user'
import { CandidateOnboardingChecklist } from '@/components/candidate/onboarding/candidate-onboarding-checklist'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Onboarding - Candidate Workspace',
  description: 'Complete required forms and files after offer acceptance',
}

export default async function CandidateOnboardingPage() {
  const user = await getCandidateUser()
  if (!user) {
    redirect('/portal/login')
  }

  return (
    <>
      <CandidateNav user={user} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Onboarding</h1>
          <p className="text-gray-600 mt-2">
            Complete all required forms and documents after offer acceptance.
          </p>
        </div>
        <CandidateOnboardingChecklist />
      </main>
    </>
  )
}
