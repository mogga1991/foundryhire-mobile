import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { generateZoomSignature } from '@/lib/integrations/zoom'

/**
 * POST /api/zoom/signature
 *
 * Generate a Zoom SDK signature for embedding meetings in the browser
 *
 * Body: { meetingNumber: string, role: 0 | 1 }
 * - meetingNumber: The Zoom meeting ID
 * - role: 0 for participant, 1 for host
 *
 * Returns: { signature: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { meetingNumber, role } = body

    if (!meetingNumber) {
      return NextResponse.json(
        { error: 'Meeting number is required' },
        { status: 400 }
      )
    }

    if (role !== 0 && role !== 1) {
      return NextResponse.json(
        { error: 'Role must be 0 (participant) or 1 (host)' },
        { status: 400 }
      )
    }

    const signature = generateZoomSignature(meetingNumber, role)

    return NextResponse.json({ signature })
  } catch (error) {
    console.error('Error generating Zoom signature:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate signature' },
      { status: 500 }
    )
  }
}
