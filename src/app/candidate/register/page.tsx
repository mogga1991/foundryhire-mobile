import type { Metadata } from 'next'
import { CandidateRegisterForm } from '@/components/auth/candidate/candidate-register-form'

export const metadata: Metadata = {
  title: 'Create Candidate Account - VerticalHire',
  description: 'Create your VerticalHire candidate account to access exclusive construction job opportunities.',
}

export default function CandidateRegisterPage() {
  return <CandidateRegisterForm />
}
