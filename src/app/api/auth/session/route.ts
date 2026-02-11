import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { getSession } from '@/lib/auth'

const logger = createLogger('api:auth:session')

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    return NextResponse.json({ user: session.user })
  } catch (error) {
    logger.error({ message: 'Failed to get session', error })
    return NextResponse.json({ user: null }, { status: 500 })
  }
}
