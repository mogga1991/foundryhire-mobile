'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Mail, Lock, Loader2, Shield } from 'lucide-react'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { GradientBackground, HeroSection } from '@/components/ui/auth-layout'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required'),
})

type LoginFormValues = z.infer<typeof loginSchema>

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_auth_failed: 'Google sign-in could not be started. Please try again.',
  oauth_denied: 'Google sign-in was canceled.',
  oauth_code_missing: 'Google sign-in returned an invalid response.',
  oauth_exchange_failed: 'Google sign-in failed. Please try again.',
  oauth_user_missing: 'Google sign-in did not return a valid account.',
  oauth_callback_failed: 'Google sign-in failed unexpectedly. Please try again.',
  legacy_conflict:
    'This account conflicts with legacy auth data. Run the Supabase user migration first.',
}

export function LoginForm() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [inlineAuthError, setInlineAuthError] = useState<string | null>(null)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    const errorCode = searchParams.get('error')
    if (!errorCode) {
      return
    }

    const description =
      OAUTH_ERROR_MESSAGES[errorCode] ?? 'Sign in failed. Please try again.'

    setInlineAuthError(description)
    toast.error('Google sign-in failed', { description })

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('error')
    const nextUrl = nextParams.toString()
      ? `${pathname}?${nextParams.toString()}`
      : pathname
    router.replace(nextUrl)
  }, [pathname, router, searchParams])

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true)
    setInlineAuthError(null)

    try {
      const payload = JSON.stringify({
        email: data.email,
        password: data.password,
      })

      let res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      })

      // Some deployments can incorrectly reject the non-trailing route with 405.
      // Retry once with trailing slash before surfacing an error.
      if (res.status === 405) {
        res = await fetch('/api/auth/login/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        })
      }

      // Check if response is JSON before parsing
      const contentType = res.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[Login Error] Server returned non-JSON response:', await res.text())
        }
        toast.error('Sign in failed', {
          description: 'Server error. Please try again or contact support.',
        })
        return
      }

      const result = await res.json()

      if (!res.ok) {
        if (res.status === 405) {
          setInlineAuthError('Sign in endpoint rejected POST. Please refresh and try again.')
        }
        toast.error('Sign in failed', {
          description: result.error || 'Invalid credentials',
        })
        return
      }

      toast.success('Welcome back!', {
        description: 'You have been signed in successfully.',
      })

      router.push('/dashboard')
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Login Error]', err)
      }
      toast.error('Sign in failed', {
        description: 'An unexpected error occurred. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row w-full">
      {/* Left Side - Sign In Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-background">
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
                Construction workforce management platform
              </p>
            </div>
          </div>

          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Welcome back
            </h2>
            <p className="text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>

          {inlineAuthError ? (
            <div
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {inlineAuthError}
            </div>
          ) : null}

          {/* Form Card */}
          <Card className="shadow-lg border-border/50">
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="email"
                              placeholder="you@company.com"
                              className="pl-10 h-11"
                              disabled={isLoading}
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-sm font-medium">Password</FormLabel>
                          <Link
                            href="/forgot-password"
                            className="text-xs text-primary hover:opacity-80 transition-opacity"
                          >
                            Forgot password?
                          </Link>
                        </div>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="password"
                              placeholder="Enter your password"
                              className="pl-10 h-11"
                              disabled={isLoading}
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-11 shadow-lg"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign in'
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11"
                    asChild
                  >
                    <Link href="/api/auth/google?next=%2Fdashboard">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Sign in with Google
                    </Link>
                  </Button>
                </form>
              </Form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link
                  href="/signup"
                  className="font-medium text-primary hover:opacity-80 transition-opacity"
                >
                  Sign up
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right Side - Hero Section */}
      <GradientBackground>
        <HeroSection
          title="Enterprise-Grade Security"
          description="Your workforce data is protected with bank-level encryption and industry-leading security measures. Sign in with confidence."
          icon={
            <Shield className="w-12 h-12" />
          }
          features={[
            "256-bit AES encryption for all data",
            "SOC 2 Type II compliant infrastructure",
            "Regular security audits and penetration testing",
            "GDPR and CCPA compliant data handling"
          ]}
        />
      </GradientBackground>
    </div>
  )
}
