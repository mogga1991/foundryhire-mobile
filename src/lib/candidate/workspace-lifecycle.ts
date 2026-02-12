export type CandidateLifecycleStatus =
  | 'active'
  | 'interviewing'
  | 'offered'
  | 'completed'
  | 'expired'

interface LifecycleInput {
  interviewStatus: string
  candidateStage?: string | null
  scheduledAt?: Date | null
  expiresAt?: Date | null
  now?: Date
}

const THREE_DAYS_IN_MS = 3 * 24 * 60 * 60 * 1000

export function getDefaultPortalExpiry(scheduledAt: Date): Date {
  return new Date(scheduledAt.getTime() + THREE_DAYS_IN_MS)
}

export function resolveCandidateWorkspaceStatus(input: LifecycleInput): CandidateLifecycleStatus {
  const now = input.now ?? new Date()

  if (input.expiresAt && input.expiresAt <= now) {
    return 'expired'
  }

  const stage = (input.candidateStage || '').toLowerCase()
  if (stage === 'offer') {
    return 'offered'
  }
  if (stage === 'hired') {
    return 'completed'
  }
  if (stage === 'rejected') {
    return 'expired'
  }

  const status = input.interviewStatus.toLowerCase()
  if (status === 'cancelled' || status === 'no_show') {
    return 'expired'
  }
  if (status === 'in_progress' || status === 'confirmed') {
    return 'interviewing'
  }
  if (status === 'completed') {
    return 'completed'
  }

  return 'active'
}
