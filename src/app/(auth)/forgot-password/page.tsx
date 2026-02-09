import type { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Forgot Password - VerticalHire',
  description: 'Reset your VerticalHire account password.',
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo / Branding */}
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
              Construction workforce management platform
            </p>
          </div>
        </div>

        {/* Card */}
        <Card className="shadow-lg border-border/50">
          <CardHeader className="text-center">
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>
              Enter your email address and we'll send you a link to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    className="pl-10 h-11"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-11 shadow-lg">
                Send reset link
              </Button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-primary hover:opacity-80"
                >
                  ← Back to sign in
                </Link>
              </div>
            </form>

            <div className="mt-6 text-center text-xs text-muted-foreground">
              <p>
                Password reset functionality is coming soon. Please contact support at{' '}
                <a href="mailto:support@verticalhire.com" className="text-primary hover:opacity-80">
                  support@verticalhire.com
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
