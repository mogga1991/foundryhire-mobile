import crypto from 'crypto'

/**
 * Zoom Integration for TalentForge
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

/**
 * Get Zoom Server-to-Server OAuth access token
 */
async function getAccessToken(): Promise<string> {
  const accountId = process.env.ZOOM_ACCOUNT_ID
  const clientId = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET

  if (!accountId || !clientId || !clientSecret) {
    throw new Error('Zoom credentials not configured. Please add ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET to environment variables.')
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

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
    throw new Error(`Failed to get Zoom access token: ${error}`)
  }

  const data = await response.json()
  return data.access_token
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
      join_before_host: false,
      mute_upon_entry: true,
      waiting_room: true,
      auto_recording: 'cloud', // Auto record to cloud
      approval_type: 0, // Automatically approve
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
  const sdkKey = process.env.ZOOM_SDK_KEY
  const sdkSecret = process.env.ZOOM_SDK_SECRET

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
