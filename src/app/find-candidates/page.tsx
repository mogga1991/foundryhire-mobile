import { Suspense } from 'react'
import { Metadata } from 'next'
import { CandidateSearchContent } from '@/components/candidates/candidate-search-content'

export const metadata: Metadata = {
  title: 'Find Candidates - VerticalHire',
  description: 'Search and discover qualified construction candidates',
}

export default function CandidatesSearchPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading candidates...</div>}>
      <CandidateSearchContent />
    </Suspense>
  )
}
