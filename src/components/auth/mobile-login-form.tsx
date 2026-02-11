'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ChevronLeft, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
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

export function MobileLoginForm() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [inlineAuthError, setInlineAuthError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  })

  const rememberMe = watch('rememberMe')

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

    try {
      const res = await fetch('/api/auth/login', {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-6 py-4">
          <Link
            href="/welcome"
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </Link>
          <div className="text-lg font-bold text-blue-600 dark:text-blue-500">
            VerticalHire
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pt-12 pb-8 max-w-md mx-auto">
        {inlineAuthError ? (
          <div
            className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {inlineAuthError}
          </div>
        ) : null}

        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
            Welcome to
          </h1>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            VerticalHire login now!
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Email Field */}
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="joedoe75@email.com"
              className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-base placeholder:text-slate-400 dark:placeholder:text-slate-500"
              disabled={isLoading}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-base pr-12 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                disabled={isLoading}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="rememberMe"
                checked={rememberMe}
                onCheckedChange={(checked) =>
                  setValue('rememberMe', checked as boolean)
                }
              />
              <label
                htmlFor="rememberMe"
                className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                Remember me
              </label>
            </div>
            <Link
              href="/forgot-password"
              className="text-sm text-blue-600 dark:text-blue-500 hover:underline font-medium"
            >
              Forgot password?
            </Link>
          </div>

          {/* Login Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base shadow-lg shadow-blue-600/30 transition-all hover:shadow-xl hover:shadow-blue-600/40"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Signing in...
              </>
            ) : (
              'Login'
            )}
          </Button>

          {/* Divider */}
          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 px-4 text-sm text-slate-500 dark:text-slate-400">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-14 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            asChild
          >
            <Link href="/api/auth/google?next=%2Fdashboard">
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
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
      </div>
    </div>
  )
}
