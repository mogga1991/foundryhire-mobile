'use client'

import { useState } from 'react'

export function ResendVerificationButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleResend = async () => {
    setIsLoading(true)
    setMessage('')

    try {
      const email =
        typeof window !== 'undefined' ? window.localStorage.getItem('candidate_email') : null

      const response = await fetch('/api/candidate/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || '' }),
      })

      if (response.ok) {
        setMessage('Verification email sent!')
      } else {
        setMessage('Failed to send email. Please try again.')
      }
    } catch (error) {
      setMessage('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <span>
      <button
        onClick={handleResend}
        disabled={isLoading}
        className="text-orange-600 hover:text-orange-700 font-medium underline disabled:opacity-50"
      >
        {isLoading ? 'Sending...' : 'Resend email'}
      </button>
      {message && <span className="ml-2 text-sm text-muted-foreground">{message}</span>}
    </span>
  )
}
