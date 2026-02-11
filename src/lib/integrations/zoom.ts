import crypto from 'crypto'
import { env } from '@/lib/env'

/**
 * Zoom Integration for VerticalHire
 *
 * This module handles:
 * 1. Creating Zoom meetings via Server-to-Server OAuth
 * 2. Generating SDK signatures for embedded meetings
 *
 * Setup required:
 * 1. Create Meeting SDK app: https://marketplace.zoom.us/develop/create (type: Meeting SDK)
 * 2. Create Server-to-Server OAuth app for API access
 * 3. Add credentials to .env.local
 */

interface ZoomMeetingResponse {
  id: string
  host_id: string
  topic: string
  type: number
  start_time: string
  duration: number
  timezone: string
  join_url: string
  password: string
  settings: {
    host_video: boolean
    participant_video: boolean
    waiting_room: boolean
    auto_recording: string
  }
}

interface CreateMeetingParams {
  topic: string
  startTime: Date
  durationMinutes: number
  timezone?: string
  agenda?: string
}

interface CachedToken {
  accessToken: string
  expiresAt: number // Unix timestamp ms
}

/**
 * Custom error class for Zoom OAuth errors
 */
class ZoomOAuthError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message)
    this.name = 'ZoomOAuthError'
  }
}

// Module-level token cache
let tokenCache: CachedToken | null = null
let tokenRefreshPromise: Promise<string> | null = null
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000 // Refresh 5 min before expiry

/**
 * Validate Zoom configuration environment variables
 */
export function validateZoomConfig(): { valid: boolean; missing: string[] } {
  const required = ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'] as const
  const missing = required.filter(key => !env[key])
  return { valid: missing.length === 0, missing }
}

/**
 * Clear the token cache (for testing)
 */
export function clearTokenCache(): void {
  tokenCache = null
  tokenRefreshPromise = null
}

/**
 * Fetch a new access token from Zoom with retry logic
 */
async function fetchAccessTokenWithRetry(): Promise<{ accessToken: string; expiresIn: number }> {
  const accountId = env.ZOOM_ACCOUNT_ID
  const clientId = env.ZOOM_CLIENT_ID
  const clientSecret = env.ZOOM_CLIENT_SECRET

  if (!accountId || !clientId || !clientSecret) {
    throw new ZoomOAuthError('Zoom credentials not configured. Please add ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET to environment variables.')
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const maxRetries = 3
  const retryableStatusCodes = [429, 500, 502, 503, 504]

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(
        `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      )

      if (!response.ok) {
        const error = await response.text()

        // Don't retry on 401 (invalid credentials)
        if (response.status === 401) {
          throw new ZoomOAuthError(`Invalid Zoom credentials: ${error}`, response.status)
        }

        // Check if we should retry
        if (retryableStatusCodes.includes(response.status) && attempt < maxRetries - 1) {
          const backoffDelay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, backoffDelay))
          continue
        }

        throw new ZoomOAuthError(`Failed to get Zoom access token: ${error}`, response.status)
      }

      const data = await response.json()
      return {
        accessToken: data.access_token,
        expiresIn: data.expires_in || 3600 // Default to 1 hour if not provided
      }
    } catch (error) {
      // If it's a ZoomOAuthError, rethrow immediately
      if (error instanceof ZoomOAuthError) {
        throw error
      }

      // For network errors, retry if attempts remain
      if (attempt < maxRetries - 1) {
        const backoffDelay = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, backoffDelay))
        continue
      }

      // Last attempt failed
      throw new ZoomOAuthError(`Network error fetching Zoom access token: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Should never reach here, but TypeScript needs this
  throw new ZoomOAuthError('Failed to fetch access token after all retries')
}

/**
 * Get Zoom Server-to-Server OAuth access token with caching
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now()

  // Check if we have a valid cached token
  if (tokenCache && tokenCache.expiresAt > now + TOKEN_REFRESH_THRESHOLD) {
    return tokenCache.accessToken
  }

  // If a token refresh is already in progress, wait for it
  if (tokenRefreshPromise) {
    return tokenRefreshPromise
  }

  // Start a new token refresh
  tokenRefreshPromise = (async () => {
    try {
      const { accessToken, expiresIn } = await fetchAccessTokenWithRetry()

      // Cache the token with expiration time
      tokenCache = {
        accessToken,
        expiresAt: Date.now() + (expiresIn * 1000)
      }

      return accessToken
    } finally {
      // Clear the promise so future calls can start a new refresh
      tokenRefreshPromise = null
    }
  })()

  return tokenRefreshPromise
}

/**
 * Create a Zoom meeting via API
 */
export async function createZoomMeeting(params: CreateMeetingParams): Promise<{
  meetingId: string
  joinUrl: string
  startUrl: string
  password: string
}> {
  const accessToken = await getAccessToken()

  const meetingData = {
    topic: params.topic,
    type: 2, // Scheduled meeting
    start_time: params.startTime.toISOString(),
    duration: params.durationMinutes,
    timezone: params.timezone || 'America/New_York',
    agenda: params.agenda || '',
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: true, // Allow candidates to join early
      mute_upon_entry: true,
      waiting_room: false, // Disable for smoother experience
      auto_recording: 'cloud', // Auto record to cloud
      approval_type: 0, // Automatically approve
      watermark: true,
      embed_password_in_join_link: true,
      registrants_email_notification: false,
      allow_multiple_devices: true,
      encryption_type: 'enhanced_encryption',
    },
  }

  const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(meetingData),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create Zoom meeting: ${error}`)
  }

  const meeting: ZoomMeetingResponse = await response.json()

  return {
    meetingId: meeting.id.toString(),
    joinUrl: meeting.join_url,
    startUrl: `https://zoom.us/s/${meeting.id}?zak=`, // Host needs to get ZAK token
    password: meeting.password,
  }
}

/**
 * Generate Zoom SDK signature for client-side embedding
 *
 * This signature authenticates the Meeting SDK in the browser
 * and must be generated server-side to keep the SDK secret secure
 */
export function generateZoomSignature(
  meetingNumber: string,
  role: 0 | 1 // 0 = participant, 1 = host
): string {
  const sdkKey = env.ZOOM_SDK_KEY
  const sdkSecret = env.ZOOM_SDK_SECRET

  if (!sdkKey || !sdkSecret) {
    throw new Error('Zoom SDK credentials not configured. Please add ZOOM_SDK_KEY and ZOOM_SDK_SECRET to environment variables.')
  }

  // Token expires in 2 hours
  const timestamp = new Date().getTime() - 30000
  const iat = Math.round(timestamp / 1000)
  const exp = iat + 60 * 60 * 2 // 2 hours

  // Create message to sign
  const msg = Buffer.from(sdkKey + meetingNumber + timestamp + role).toString('base64')

  // Generate HMAC signature
  const hash = crypto.createHmac('sha256', sdkSecret).update(msg).digest('base64')

  // Combine into final signature
  const signature = Buffer.from(`${sdkKey}.${meetingNumber}.${timestamp}.${role}.${hash}`).toString('base64')

  return signature
}

/**
 * Delete a Zoom meeting
 */
export async function deleteZoomMeeting(meetingId: string): Promise<void> {
  const accessToken = await getAccessToken()

  const response = await fetch(
    `https://api.zoom.us/v2/meetings/${meetingId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok && response.status !== 404) {
    const error = await response.text()
    throw new Error(`Failed to delete Zoom meeting: ${error}`)
  }
}

/**
 * Get meeting recording URLs
 */
export async function getMeetingRecordings(meetingId: string): Promise<{
  recordingFiles: Array<{
    id: string
    recording_type: string
    file_type: string
    file_size: number
    download_url: string
    play_url: string
  }>
} | null> {
  const accessToken = await getAccessToken()

  const response = await fetch(
    `https://api.zoom.us/v2/meetings/${meetingId}/recordings`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  )

  if (response.status === 404) {
    return null // No recordings found
  }

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get meeting recordings: ${error}`)
  }

  const data = await response.json()
  return data
}
