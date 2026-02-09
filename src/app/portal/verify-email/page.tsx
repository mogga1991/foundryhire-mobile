import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ResendVerificationButton } from '@/components/portal/resend-verification-button'

export const metadata: Metadata = {
  title: 'Verify Your Email - VerticalHire',
  description: 'Verify your email address to complete your VerticalHire candidate account setup.',
}

export default function CandidateVerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 via-white to-orange-50">
      <div className="w-full max-w-md space-y-8">
        {/* Logo / Branding */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center">
            <Image
              src="/verticalhire.png"
              alt="VerticalHire"
              width={56}
              height={56}
              className="object-contain"
            />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              VerticalHire
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your construction career portal
            </p>
          </div>
        </div>

        {/* Verification Card */}
        <Card className="shadow-lg border-orange-500/20">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
              <Mail className="w-8 h-8 text-orange-600" />
            </div>
            <CardTitle className="text-2xl">Check Your Email</CardTitle>
            <CardDescription>
              We've sent a verification link to your email address
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Instructions */}
            <div className="space-y-4 text-sm text-muted-foreground">
              <div className="flex gap-3">
                <CheckCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <p>
                  Click the verification link in your email to activate your account
                </p>
              </div>
              <div className="flex gap-3">
                <CheckCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <p>
                  Check your spam folder if you don't see the email in your inbox
                </p>
              </div>
              <div className="flex gap-3">
                <CheckCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <p>
                  Once verified, you'll have full access to your candidate dashboard
                </p>
              </div>
            </div>

            {/* Note */}
            <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
              <p className="text-sm text-orange-900">
                <strong>Note:</strong> You can still access your dashboard, but some features
                may be limited until you verify your email address.
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                asChild
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Link href="/portal/dashboard">
                  Go to Dashboard
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="w-full border-orange-200 hover:bg-orange-50"
              >
                <Link href="/portal/login">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Link>
              </Button>
            </div>

            {/* Resend Link */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Didn't receive the email?{' '}
                <ResendVerificationButton />
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
