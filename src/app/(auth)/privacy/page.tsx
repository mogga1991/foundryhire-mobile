import type { Metadata } from 'next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy - VerticalHire',
  description: 'Privacy Policy for VerticalHire construction workforce management platform.',
}

export default function PrivacyPage() {
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
              Privacy Policy
            </p>
          </div>
        </div>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle>Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

            <h2>Introduction</h2>
            <p>
              VerticalHire ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our construction workforce management platform.
            </p>

            <h2>Information We Collect</h2>
            <p>We collect information that you provide directly to us, including:</p>
            <ul>
              <li>Account information (name, email address, password)</li>
              <li>Company information</li>
              <li>Candidate and job posting data</li>
              <li>Usage data and analytics</li>
            </ul>

            <h2>How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, maintain, and improve our services</li>
              <li>Process your transactions</li>
              <li>Send you technical notices and support messages</li>
              <li>Respond to your comments and questions</li>
            </ul>

            <h2>Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
            </p>

            <h2>Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:privacy@verticalhire.com" className="text-primary hover:opacity-80">
                privacy@verticalhire.com
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
