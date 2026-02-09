import type { Metadata } from 'next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service - VerticalHire',
  description: 'Terms of Service for VerticalHire construction workforce management platform.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <Link href="/" className="flex h-14 w-14 items-center justify-center transition-transform hover:scale-105">
            <Image
              src="/verticalhire.png"
              alt="VerticalHire"
              width={56}
              height={56}
              className="object-contain"
            />
          </Link>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              VerticalHire
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Terms of Service
            </p>
          </div>
        </div>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle>Terms of Service</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

            <h2>Agreement to Terms</h2>
            <p>
              By accessing or using VerticalHire, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using this service.
            </p>

            <h2>Use License</h2>
            <p>
              Permission is granted to temporarily access VerticalHire for personal or commercial use. This is the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul>
              <li>Modify or copy the materials</li>
              <li>Use the materials for any commercial purpose without proper subscription</li>
              <li>Attempt to reverse engineer any software contained in VerticalHire</li>
              <li>Remove any copyright or proprietary notations</li>
            </ul>

            <h2>Service Description</h2>
            <p>
              VerticalHire provides a construction workforce management platform that helps companies source, manage, and engage with candidates.
            </p>

            <h2>User Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.
            </p>

            <h2>Limitation of Liability</h2>
            <p>
              VerticalHire shall not be liable for any damages arising out of the use or inability to use the service, even if VerticalHire has been notified of the possibility of such damages.
            </p>

            <h2>Contact Information</h2>
            <p>
              Questions about the Terms of Service should be sent to{' '}
              <a href="mailto:legal@verticalhire.com" className="text-primary hover:opacity-80">
                legal@verticalhire.com
              </a>
            </p>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link href="/signup" className="text-sm text-primary hover:opacity-80">
            ← Back to Sign Up
          </Link>
        </div>
      </div>
    </div>
  )
}
