'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCw, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Portal error:', error)
  }, [error])

  // Check if the error is related to expired tokens
  const isExpiredToken = error.message?.toLowerCase().includes('expired')
  const isInvalidToken = error.message?.toLowerCase().includes('invalid') ||
                        error.message?.toLowerCase().includes('not found')

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Error Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>

          {/* Title & Description */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {isExpiredToken && 'Interview Link Expired'}
              {isInvalidToken && !isExpiredToken && 'Invalid Interview Link'}
              {!isExpiredToken && !isInvalidToken && 'Something Went Wrong'}
            </h1>
            <p className="text-gray-600">
              {isExpiredToken &&
                'This interview portal link has expired. Please request a new link from the hiring team.'
              }
              {isInvalidToken && !isExpiredToken &&
                'This interview portal link is invalid or no longer active. Please check the link or contact the hiring team.'
              }
              {!isExpiredToken && !isInvalidToken &&
                'We encountered an unexpected error while loading your interview portal. Please try again.'
              }
            </p>
          </div>

          {/* Error Details (only in development) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-mono text-gray-600 break-words">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs text-gray-500 mt-2">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Try Again Button (only for non-expired, non-invalid errors) */}
            {!isExpiredToken && !isInvalidToken && (
              <Button
                onClick={reset}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                size="lg"
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                Try Again
              </Button>
            )}

            {/* Contact Support */}
            <Button
              onClick={() => window.location.href = 'mailto:support@verticalhire.com?subject=Interview Portal Issue'}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <Mail className="h-5 w-5 mr-2" />
              Contact Support
            </Button>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            {isExpiredToken || isInvalidToken
              ? 'The hiring team can send you a new interview link.'
              : 'If the problem persists, please contact the hiring team.'
            }
          </p>
        </div>
      </div>
    </div>
  )
}
