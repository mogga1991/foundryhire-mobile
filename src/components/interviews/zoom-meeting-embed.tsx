'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// Zoom SDK CDN URL — loaded via script tag to avoid React 19 bundler conflicts
const ZOOM_SDK_CDN = 'https://source.zoom.us/meetingsdk/embedded/5.1.0/zoomus-websdk-embedded.umd.min.js'

interface ZoomMeetingEmbedProps {
  meetingNumber: string
  userName: string
  userEmail: string
  password?: string
  role: 0 | 1 // 0 = participant, 1 = host
  portalToken?: string // Optional portal token for candidate access
  onMeetingEnd?: () => void
  onMeetingError?: (error: Error) => void
}

/**
 * Loads the Zoom Embedded SDK via a <script> tag.
 * This avoids the "ReactCurrentOwner" crash that happens when
 * Turbopack / React 19 tries to bundle the Zoom UMD file which
 * contains its own internal copy of React.
 */
function loadZoomScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already loaded
    if ((window as any).ZoomMtgEmbedded) {
      resolve()
      return
    }

    // Already loading
    const existing = document.querySelector(`script[src="${ZOOM_SDK_CDN}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load Zoom SDK')))
      return
    }

    const script = document.createElement('script')
    script.src = ZOOM_SDK_CDN
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Zoom SDK from CDN'))
    document.head.appendChild(script)
  })
}

/**
 * Zoom Meeting Embed Component
 *
 * Embeds a Zoom meeting directly in the page using the Zoom Meeting SDK.
 * The SDK is loaded via CDN <script> tag to avoid React 19 bundler conflicts.
 */
export function ZoomMeetingEmbed({
  meetingNumber,
  userName,
  userEmail,
  password = '',
  role,
  portalToken,
  onMeetingEnd,
  onMeetingError,
}: ZoomMeetingEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const clientRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  // Only render on client side
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleError = useCallback(
    (err: unknown) => {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to initialize Zoom meeting'
      setError(errorMessage)
      setIsLoading(false)
      onMeetingError?.(err instanceof Error ? err : new Error(errorMessage))
    },
    [onMeetingError]
  )

  useEffect(() => {
    if (!isMounted) return

    let mounted = true

    async function initZoom() {
      try {
        if (!containerRef.current) return

        // Load Zoom SDK via CDN script tag
        await loadZoomScript()

        const ZoomMtgEmbedded = (window as any).ZoomMtgEmbedded
        if (!ZoomMtgEmbedded) {
          throw new Error('Zoom SDK failed to initialize')
        }

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
        const headers: HeadersInit = { 'Content-Type': 'application/json' }

        // Add Bearer token for portal access if provided
        if (portalToken) {
          headers['Authorization'] = `Bearer ${portalToken}`
        }

        const signatureResponse = await fetch('/api/zoom/signature', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            meetingNumber,
            role,
          }),
        })

        if (!signatureResponse.ok) {
          const body = await signatureResponse.json().catch(() => ({}))
          throw new Error(body.error || 'Failed to generate Zoom signature')
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
      } catch (err) {
        if (mounted) {
          handleError(err)
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
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }, [isMounted, meetingNumber, userName, userEmail, password, role, portalToken, handleError])

  // Don't render on server side
  if (!isMounted) {
    return (
      <div className="relative w-full h-full bg-gray-900 rounded-2xl overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-sm text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

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
