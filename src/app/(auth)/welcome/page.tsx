import type { Metadata } from 'next'
import { MobileWelcomeScreen } from '@/components/auth/mobile-welcome-screen'

export const metadata: Metadata = {
  title: 'Welcome - VerticalHire',
  description:
    'Welcome to VerticalHire - AI-powered construction recruitment platform',
}

export default function WelcomePage() {
  return <MobileWelcomeScreen />
}
