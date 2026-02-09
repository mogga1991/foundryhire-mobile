import { NextResponse } from 'next/server'
import { deleteSession } from '@/lib/auth'

export async function POST() {
  try {
    await deleteSession()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/auth/logout error:', error)
    return NextResponse.json(
      { error: 'Failed to sign out' },
      { status: 500 }
    )
  }
}
