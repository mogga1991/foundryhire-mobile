import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { db } from '@/lib/db'
import { candidateUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { CandidateProfileView } from '@/components/candidates/candidate-profile-view'

interface Props {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params

  const [candidate] = await db.select()
    .from(candidateUsers)
    .where(eq(candidateUsers.id, id))
    .limit(1)

  if (!candidate) {
    return {
      title: 'Candidate Not Found - VerticalHire',
    }
  }

  return {
    title: `${candidate.firstName} ${candidate.lastName} - VerticalHire`,
    description: candidate.bio || `View ${candidate.firstName}'s profile and professional experience`,
  }
}

export default async function CandidateProfilePage({ params }: Props) {
  const { id } = await params

  const [candidate] = await db.select()
    .from(candidateUsers)
    .where(eq(candidateUsers.id, id))
    .limit(1)

  if (!candidate) {
    notFound()
  }

  return <CandidateProfileView candidate={candidate} />
}
