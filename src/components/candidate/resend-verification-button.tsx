'use client'

import { useState } from 'react'
import { toast } from 'sonner'

export function ResendVerificationButton() {
  const [isResending, setIsResending] = useState(false)

  async function handleResend() {
    setIsResending(true)
    try {
      const urlParams = new URLSearchParams(window.location.search)
      const email = urlParams.get('email')

      if (!email) {
        toast.error('Email not found', {
          description: 'Please try logging in again.',
        })
        return
      }

      const response = await fetch('/api/candidate/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend verification email')
      }

      toast.success('Verification email sent!', {
        description: 'Please check your inbox and spam folder.',
      })
    } catch (error) {
      toast.error('Failed to resend', {
        description: error instanceof Error ? error.message : 'Please try again later.',
      })
    } finally {
      setIsResending(false)
    }
  }

  return (
    <button
      className="font-medium text-orange-600 hover:text-orange-700 transition-colors disabled:opacity-50"
      onClick={handleResend}
      disabled={isResending}
    >
      {isResending ? 'Sending...' : 'Resend verification link'}
    </button>
  )
}
