'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Mail, Lock, Loader2, Briefcase } from 'lucide-react'

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
import { CandidateGradientBackground, CandidateHeroSection } from '@/components/ui/candidate-auth-layout'

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

export function CandidateLoginForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true)

    try {
      const res = await fetch('/api/portal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      })

      // Check if response is JSON before parsing
      const contentType = res.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        console.error('[Candidate Login Error] Server returned non-JSON response:', await res.text())
        toast.error('Sign in failed', {
          description: 'Server error. Please try again or contact support.',
        })
        return
      }

      const result = await res.json()

      if (!res.ok) {
        toast.error('Sign in failed', {
          description: result.error || 'Invalid credentials',
        })
        return
      }

      toast.success('Welcome back!', {
        description: 'You have been signed in successfully.',
      })

      router.push('/portal/dashboard')
    } catch (err) {
      console.error('[Candidate Login Error]', err)
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
                Your construction career portal
              </p>
            </div>
          </div>

          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Welcome back
            </h2>
            <p className="text-muted-foreground">
              Sign in to access your job opportunities
            </p>
          </div>

          {/* Form Card with Orange accent */}
          <Card className="shadow-lg border-orange-500/20">
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
                              placeholder="you@email.com"
                              className="pl-10 h-11 focus-visible:ring-orange-500"
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
                            href="/portal/forgot-password"
                            className="text-xs text-orange-600 hover:text-orange-700 transition-colors"
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
                              className="pl-10 h-11 focus-visible:ring-orange-500"
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
                    className="w-full h-11 shadow-lg bg-orange-600 hover:bg-orange-700 text-white"
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
                </form>
              </Form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link
                  href="/portal/register"
                  className="font-medium text-orange-600 hover:text-orange-700 transition-colors"
                >
                  Create account
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right Side - Hero Section with Orange Theme */}
      <CandidateGradientBackground>
        <CandidateHeroSection
          title="Find Your Next Opportunity"
          description="Access exclusive construction job opportunities from top employers. Your next career move starts here."
          icon={
            <Briefcase className="w-12 h-12" />
          }
          features={[
            "Direct access to verified construction employers",
            "Track your applications in real-time",
            "Get interview invitations instantly",
            "Build your professional profile"
          ]}
        />
      </CandidateGradientBackground>
    </div>
  )
}
