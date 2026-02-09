import type { Metadata } from 'next'
import { CandidateLoginForm } from '@/components/auth/candidate/candidate-login-form'

export const metadata: Metadata = {
  title: 'Candidate Sign In - VerticalHire',
  description: 'Sign in to your VerticalHire candidate account to access job opportunities.',
}

export default function CandidateLoginPage() {
  return <CandidateLoginForm />
}
