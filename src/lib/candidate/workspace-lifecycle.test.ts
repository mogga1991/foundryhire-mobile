import { describe, expect, it } from 'vitest'
import {
  getDefaultPortalExpiry,
  resolveCandidateWorkspaceStatus,
} from './workspace-lifecycle'

describe('workspace lifecycle', () => {
  it('sets default expiry to 3 days after schedule', () => {
    const scheduledAt = new Date('2026-02-01T12:00:00.000Z')
    const expiry = getDefaultPortalExpiry(scheduledAt)
    expect(expiry.toISOString()).toBe('2026-02-04T12:00:00.000Z')
  })

  it('expires when explicit expiry is passed', () => {
    const status = resolveCandidateWorkspaceStatus({
      interviewStatus: 'scheduled',
      expiresAt: new Date('2026-02-01T12:00:00.000Z'),
      now: new Date('2026-02-02T12:00:00.000Z'),
    })
    expect(status).toBe('expired')
  })

  it('marks offered stage as offered', () => {
    const status = resolveCandidateWorkspaceStatus({
      interviewStatus: 'scheduled',
      candidateStage: 'offer',
    })
    expect(status).toBe('offered')
  })

  it('marks cancelled interviews as expired', () => {
    const status = resolveCandidateWorkspaceStatus({
      interviewStatus: 'cancelled',
    })
    expect(status).toBe('expired')
  })
})
