import { NextRequest } from 'next/server'
import { POST as candidateLoginPost } from '@/app/api/candidate/auth/login/route'

// Backward-compatible alias for legacy portal login clients.
export async function POST(request: NextRequest) {
  return candidateLoginPost(request)
}
