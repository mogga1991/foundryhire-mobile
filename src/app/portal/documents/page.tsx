import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CandidateNav } from '@/components/candidate/candidate-nav'
import { getCandidateUser } from '@/lib/auth/get-candidate-user'
import { CandidateDocumentsCenter } from '@/components/candidate/documents/candidate-documents-center'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Documents - Candidate Workspace',
  description: 'Upload and manage your required interview documents',
}

export default async function CandidateDocumentsPage() {
  const user = await getCandidateUser()
  if (!user) {
    redirect('/portal/login')
  }

  return (
    <>
      <CandidateNav user={user} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600 mt-2">
            Upload required files for interview and offer consideration.
          </p>
        </div>
        <CandidateDocumentsCenter />
      </main>
    </>
  )
}
