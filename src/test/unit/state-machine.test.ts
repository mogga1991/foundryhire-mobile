/**
 * Interview State Machine Tests
 *
 * Tests the interview state transition logic to ensure only valid state
 * transitions are allowed according to business rules.
 *
 * Valid Interview Statuses:
 * - scheduled: Initial state when interview is created
 * - in_progress: Interview is currently happening
 * - completed: Interview has finished successfully
 * - cancelled: Interview was cancelled (terminal state)
 *
 * Valid Transitions:
 * - scheduled -> in_progress (interview starts)
 * - scheduled -> cancelled (interview cancelled before starting)
 * - in_progress -> completed (interview finishes normally)
 * - in_progress -> cancelled (interview cancelled while in progress)
 *
 * Invalid Transitions:
 * - scheduled -> completed (must go through in_progress)
 * - completed -> any status (terminal state)
 * - cancelled -> any status (terminal state)
 * - any status -> scheduled (cannot reschedule to scheduled state)
 */

import { describe, it, expect } from 'vitest'

// Valid interview statuses
type InterviewStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

// State machine valid transitions map
const VALID_TRANSITIONS: Record<InterviewStatus, InterviewStatus[]> = {
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [], // Terminal state
  cancelled: [], // Terminal state
}

/**
 * Checks if a transition from one status to another is valid
 */
function isValidTransition(from: InterviewStatus, to: InterviewStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Checks if a status is a terminal state (no transitions allowed)
 */
function isTerminalState(status: InterviewStatus): boolean {
  return VALID_TRANSITIONS[status]?.length === 0
}

describe('Interview State Machine', () => {
  describe('Valid Transitions', () => {
    it('should allow scheduled -> in_progress', () => {
      expect(isValidTransition('scheduled', 'in_progress')).toBe(true)
    })

    it('should allow scheduled -> cancelled', () => {
      expect(isValidTransition('scheduled', 'cancelled')).toBe(true)
    })

    it('should allow in_progress -> completed', () => {
      expect(isValidTransition('in_progress', 'completed')).toBe(true)
    })

    it('should allow in_progress -> cancelled', () => {
      expect(isValidTransition('in_progress', 'cancelled')).toBe(true)
    })
  })

  describe('Invalid Transitions', () => {
    it('should NOT allow scheduled -> completed (must go through in_progress)', () => {
      expect(isValidTransition('scheduled', 'completed')).toBe(false)
    })

    it('should NOT allow scheduled -> scheduled (no self-transitions)', () => {
      expect(isValidTransition('scheduled', 'scheduled')).toBe(false)
    })

    it('should NOT allow in_progress -> scheduled', () => {
      expect(isValidTransition('in_progress', 'scheduled')).toBe(false)
    })

    it('should NOT allow in_progress -> in_progress (no self-transitions)', () => {
      expect(isValidTransition('in_progress', 'in_progress')).toBe(false)
    })
  })

  describe('Terminal States', () => {
    it('should identify completed as terminal state', () => {
      expect(isTerminalState('completed')).toBe(true)
    })

    it('should identify cancelled as terminal state', () => {
      expect(isTerminalState('cancelled')).toBe(true)
    })

    it('should NOT identify scheduled as terminal state', () => {
      expect(isTerminalState('scheduled')).toBe(false)
    })

    it('should NOT identify in_progress as terminal state', () => {
      expect(isTerminalState('in_progress')).toBe(false)
    })

    it('should NOT allow completed -> any transition', () => {
      expect(isValidTransition('completed', 'scheduled')).toBe(false)
      expect(isValidTransition('completed', 'in_progress')).toBe(false)
      expect(isValidTransition('completed', 'cancelled')).toBe(false)
      expect(isValidTransition('completed', 'completed')).toBe(false)
    })

    it('should NOT allow cancelled -> any transition', () => {
      expect(isValidTransition('cancelled', 'scheduled')).toBe(false)
      expect(isValidTransition('cancelled', 'in_progress')).toBe(false)
      expect(isValidTransition('cancelled', 'completed')).toBe(false)
      expect(isValidTransition('cancelled', 'cancelled')).toBe(false)
    })
  })

  describe('Transition Validation Logic', () => {
    it('should validate all scheduled state transitions', () => {
      const validTargets = ['in_progress', 'cancelled']
      const allStatuses: InterviewStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled']

      allStatuses.forEach((targetStatus) => {
        const shouldBeValid = validTargets.includes(targetStatus)
        expect(isValidTransition('scheduled', targetStatus)).toBe(shouldBeValid)
      })
    })

    it('should validate all in_progress state transitions', () => {
      const validTargets = ['completed', 'cancelled']
      const allStatuses: InterviewStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled']

      allStatuses.forEach((targetStatus) => {
        const shouldBeValid = validTargets.includes(targetStatus)
        expect(isValidTransition('in_progress', targetStatus)).toBe(shouldBeValid)
      })
    })

    it('should ensure terminal states have no valid transitions', () => {
      const terminalStates: InterviewStatus[] = ['completed', 'cancelled']
      const allStatuses: InterviewStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled']

      terminalStates.forEach((terminalState) => {
        allStatuses.forEach((targetStatus) => {
          expect(isValidTransition(terminalState, targetStatus)).toBe(false)
        })
      })
    })
  })

  describe('Business Logic Edge Cases', () => {
    it('should prevent interviews from skipping in_progress when completing', () => {
      // Business rule: An interview must be in progress before it can be completed
      expect(isValidTransition('scheduled', 'completed')).toBe(false)
    })

    it('should allow cancellation from any non-terminal state', () => {
      // Business rule: Interviews can be cancelled at any time before completion
      expect(isValidTransition('scheduled', 'cancelled')).toBe(true)
      expect(isValidTransition('in_progress', 'cancelled')).toBe(true)
    })

    it('should prevent state changes after completion', () => {
      // Business rule: Once completed, no further state changes allowed
      const allStatuses: InterviewStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled']
      allStatuses.forEach((status) => {
        expect(isValidTransition('completed', status)).toBe(false)
      })
    })

    it('should prevent state changes after cancellation', () => {
      // Business rule: Once cancelled, no further state changes allowed
      const allStatuses: InterviewStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled']
      allStatuses.forEach((status) => {
        expect(isValidTransition('cancelled', status)).toBe(false)
      })
    })
  })

  describe('VALID_TRANSITIONS Map Structure', () => {
    it('should have entries for all interview statuses', () => {
      const allStatuses: InterviewStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled']
      allStatuses.forEach((status) => {
        expect(VALID_TRANSITIONS).toHaveProperty(status)
        expect(Array.isArray(VALID_TRANSITIONS[status])).toBe(true)
      })
    })

    it('should not allow any status to transition to itself', () => {
      const allStatuses: InterviewStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled']
      allStatuses.forEach((status) => {
        expect(VALID_TRANSITIONS[status]).not.toContain(status)
      })
    })

    it('should define exactly 2 valid transitions for scheduled state', () => {
      expect(VALID_TRANSITIONS.scheduled).toHaveLength(2)
      expect(VALID_TRANSITIONS.scheduled).toContain('in_progress')
      expect(VALID_TRANSITIONS.scheduled).toContain('cancelled')
    })

    it('should define exactly 2 valid transitions for in_progress state', () => {
      expect(VALID_TRANSITIONS.in_progress).toHaveLength(2)
      expect(VALID_TRANSITIONS.in_progress).toContain('completed')
      expect(VALID_TRANSITIONS.in_progress).toContain('cancelled')
    })

    it('should define 0 valid transitions for completed state', () => {
      expect(VALID_TRANSITIONS.completed).toHaveLength(0)
    })

    it('should define 0 valid transitions for cancelled state', () => {
      expect(VALID_TRANSITIONS.cancelled).toHaveLength(0)
    })
  })
})

// Export the state machine logic for potential reuse in the API route
export { VALID_TRANSITIONS, isValidTransition, isTerminalState }
export type { InterviewStatus }
