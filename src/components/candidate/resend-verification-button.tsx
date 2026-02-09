'use client'

import { useState } from 'react'
import { toast } from 'sonner'

export function ResendVerificationButton() {
  const [isResending, setIsResending] = useState(false)

  async function handleResend() {
    setIsResending(true)
    try {
      // TODO: Implement resend verification email API endpoint
      toast.info('Coming soon', {
        description: 'Resend verification email functionality will be available soon!',
      })
    } catch (error) {
      toast.error('Failed to resend', {
        description: 'Please try again later.',
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
