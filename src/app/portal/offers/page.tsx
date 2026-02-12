import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CandidateNav } from '@/components/candidate/candidate-nav'
import { getCandidateUser } from '@/lib/auth/get-candidate-user'
import { CandidateOffersBoard } from '@/components/candidate/offers/candidate-offers-board'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Offers - Candidate Workspace',
  description: 'Review and accept employer offers before expiration',
}

export default async function CandidateOffersPage() {
  const user = await getCandidateUser()
  if (!user) {
    redirect('/portal/login')
  }

  return (
    <>
      <CandidateNav user={user} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Offers</h1>
          <p className="text-gray-600 mt-2">Review your offer terms and accept before expiry.</p>
        </div>
        <CandidateOffersBoard />
      </main>
    </>
  )
}
