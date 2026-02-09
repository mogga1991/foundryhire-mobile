import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'
import { MobileLoginForm } from '@/components/auth/mobile-login-form'

export const metadata: Metadata = {
  title: 'Sign In - VerticalHire',
  description: 'Sign in to your VerticalHire account to manage your construction workforce.',
}

export default function LoginPage() {
  return (
    <>
      {/* Mobile View */}
      <div className="lg:hidden">
        <MobileLoginForm />
      </div>

      {/* Desktop View */}
      <div className="hidden lg:block">
        <LoginForm />
      </div>
    </>
  )
}
