import type { Metadata } from 'next'
import { SignupForm } from '@/components/auth/signup-form'
import { MobileSignupForm } from '@/components/auth/mobile-signup-form'

export const metadata: Metadata = {
  title: 'Create Account - VerticalHire',
  description: 'Create your VerticalHire account to start managing your construction workforce.',
}

export default function SignupPage() {
  return (
    <>
      {/* Mobile View */}
      <div className="lg:hidden">
        <MobileSignupForm />
      </div>

      {/* Desktop View */}
      <div className="hidden lg:block">
        <SignupForm />
      </div>
    </>
  )
}
