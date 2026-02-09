'use client'

import { useEffect, useRef, useState } from 'react'
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded'

interface ZoomMeetingEmbedProps {
  meetingNumber: string
  userName: string
  userEmail: string
  password?: string
  role: 0 | 1 // 0 = participant, 1 = host
  onMeetingEnd?: () => void
  onMeetingError?: (error: Error) => void
}

/**
 * Zoom Meeting Embed Component
 *
 * Embeds a Zoom meeting directly in the page using the Zoom Meeting SDK
 * This component handles:
 * - SDK initialization
 * - Signature generation via API
 * - Meeting join
 * - Cleanup on unmount
 */
export function ZoomMeetingEmbed({
  meetingNumber,
  userName,
  userEmail,
  password = '',
  role,
  onMeetingEnd,
  onMeetingError,
}: ZoomMeetingEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const clientRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function initZoom() {
      try {
        if (!containerRef.current) return

        // Initialize Zoom client
        const client = ZoomMtgEmbedded.createClient()
        clientRef.current = client

        // Initialize the SDK
        await client.init({
          zoomAppRoot: containerRef.current,
          language: 'en-US',
          customize: {
            video: {
              isResizable: false,
              viewSizes: {
                default: {
                  width: containerRef.current.offsetWidth,
                  height: containerRef.current.offsetHeight,
                },
              },
            },
          },
        })

        // Get signature from our API
        const signatureResponse = await fetch('/api/zoom/signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meetingNumber,
            role,
          }),
        })

        if (!signatureResponse.ok) {
          throw new Error('Failed to generate Zoom signature')
        }

        const { signature } = await signatureResponse.json()

        // Join the meeting
        await client.join({
          sdkKey: process.env.NEXT_PUBLIC_ZOOM_SDK_KEY || '',
          signature,
          meetingNumber,
          password,
          userName,
          userEmail,
          tk: '', // Registration token (empty for non-registered users)
        })

        if (mounted) {
          setIsLoading(false)
        }

        // Note: Meeting end event handling would go here if needed
        // The Zoom SDK events vary by version and configuration
      } catch (err) {
        console.error('Zoom initialization error:', err)
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Zoom meeting'
          setError(errorMessage)
          setIsLoading(false)
          if (onMeetingError) {
            onMeetingError(err instanceof Error ? err : new Error(errorMessage))
          }
        }
      }
    }

    initZoom()

    return () => {
      mounted = false
      // Cleanup: leave meeting if still in session
      if (clientRef.current) {
        try {
          clientRef.current.leaveMeeting()
        } catch (err) {
          console.error('Error leaving meeting:', err)
        }
      }
    }
  }, [meetingNumber, userName, userEmail, password, role, onMeetingEnd, onMeetingError])

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 rounded-2xl">
        <div className="text-center text-white p-8">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <h3 className="font-semibold mb-2">Failed to Load Meeting</h3>
          <p className="text-sm text-gray-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-medium transition"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-2xl overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-sm text-gray-400">Connecting to meeting...</p>
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
