import { NextRequest } from 'next/server'
import { POST as candidateRegisterPost } from '@/app/api/candidate/auth/register/route'

// Backward-compatible alias for legacy portal register clients.
export async function POST(request: NextRequest) {
  return candidateRegisterPost(request)
}
