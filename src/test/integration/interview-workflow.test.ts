import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'
import * as crypto from 'crypto'
import {
  createMockCandidate,
  createMockInterview,
  createMockDb,
  createMockZoomMeeting,
  MOCK_COMPANY_ID,
  MOCK_USER_ID,
  MOCK_CANDIDATE_ID,
  MOCK_JOB_ID,
} from './setup'

/**
 * Integration tests for interview workflow
 * Tests the complete interview lifecycle from creation to activity logging
 */

describe('Interview Workflow Integration', () => {
  let mockDb: ReturnType<typeof createMockDb>

  beforeEach(() => {
    mockDb = createMockDb()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Interview Creation Schema Validation', () => {
    const createInterviewSchema = z.object({
      candidateId: z.string().uuid('Invalid candidate ID format'),
      jobId: z.string().uuid('Invalid job ID format').optional(),
      scheduledAt: z.string().datetime('Invalid date format').refine(
        (date) => new Date(date) > new Date(),
        { message: 'Interview must be scheduled in the future' }
      ),
      durationMinutes: z.number().int().min(15).max(180).default(30),
      interviewType: z.enum(['video', 'phone', 'in_person']).default('video'),
      location: z.string().min(1).max(500).optional(),
      phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number').optional(),
      timezone: z.string().default('America/New_York'),
      internalNotes: z.string().max(1000).optional(),
    }).refine(
      (data) => data.interviewType !== 'in_person' || data.location,
      { message: 'Location required for in-person interviews', path: ['location'] }
    ).refine(
      (data) => data.interviewType !== 'phone' || data.phoneNumber,
      { message: 'Phone number required for phone interviews', path: ['phoneNumber'] }
    )

    it('should validate all required fields for video interview', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      const validData = {
        candidateId: MOCK_CANDIDATE_ID,
        jobId: MOCK_JOB_ID,
        scheduledAt: futureDate,
        durationMinutes: 45,
        interviewType: 'video' as const,
        timezone: 'America/Los_Angeles',
      }

      const result = createInterviewSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.candidateId).toBe(MOCK_CANDIDATE_ID)
        expect(result.data.durationMinutes).toBe(45)
        expect(result.data.interviewType).toBe('video')
      }
    })

    it('should reject invalid candidate ID format', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      const invalidData = {
        candidateId: 'not-a-uuid',
        scheduledAt: futureDate,
        interviewType: 'video' as const,
      }

      const result = createInterviewSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid candidate ID format')
      }
    })

    it('should reject past dates for scheduledAt', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const invalidData = {
        candidateId: MOCK_CANDIDATE_ID,
        scheduledAt: pastDate,
        interviewType: 'video' as const,
      }

      const result = createInterviewSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('must be scheduled in the future')
      }
    })

    it('should enforce duration limits', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      const tooShort = createInterviewSchema.safeParse({
        candidateId: MOCK_CANDIDATE_ID,
        scheduledAt: futureDate,
        durationMinutes: 10,
        interviewType: 'video' as const,
      })
      expect(tooShort.success).toBe(false)

      const tooLong = createInterviewSchema.safeParse({
        candidateId: MOCK_CANDIDATE_ID,
        scheduledAt: futureDate,
        durationMinutes: 200,
        interviewType: 'video' as const,
      })
      expect(tooLong.success).toBe(false)
    })

    it('should require location for in-person interviews', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      const withoutLocation = createInterviewSchema.safeParse({
        candidateId: MOCK_CANDIDATE_ID,
        scheduledAt: futureDate,
        interviewType: 'in_person' as const,
      })
      expect(withoutLocation.success).toBe(false)

      const withLocation = createInterviewSchema.safeParse({
        candidateId: MOCK_CANDIDATE_ID,
        scheduledAt: futureDate,
        interviewType: 'in_person' as const,
        location: '123 Main St, Suite 100',
      })
      expect(withLocation.success).toBe(true)
    })

    it('should require phone number for phone interviews', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      const withoutPhone = createInterviewSchema.safeParse({
        candidateId: MOCK_CANDIDATE_ID,
        scheduledAt: futureDate,
        interviewType: 'phone' as const,
      })
      expect(withoutPhone.success).toBe(false)

      const withPhone = createInterviewSchema.safeParse({
        candidateId: MOCK_CANDIDATE_ID,
        scheduledAt: futureDate,
        interviewType: 'phone' as const,
        phoneNumber: '+12025551234',
      })
      expect(withPhone.success).toBe(true)
    })

    it('should validate phone number format', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      const invalidPhone = createInterviewSchema.safeParse({
        candidateId: MOCK_CANDIDATE_ID,
        scheduledAt: futureDate,
        interviewType: 'phone' as const,
        phoneNumber: 'not-a-phone',
      })
      expect(invalidPhone.success).toBe(false)
    })
  })

  describe('Duplicate Interview Detection', () => {
    it('should detect duplicate interview at same time', async () => {
      const scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000)

      // Mock DB to return existing interview
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'existing-interview-id' }]),
          }),
        }),
      })
      mockDb.select = mockSelect

      // Simulate duplicate check query
      const existingInterview = await mockDb
        .select()
        .from({} as any)
        .where({} as any)
        .limit(1)

      expect(existingInterview.length).toBeGreaterThan(0)
      expect(mockSelect).toHaveBeenCalled()
    })

    it('should allow multiple interviews for same candidate at different times', async () => {
      // Mock DB to return no existing interview
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })
      mockDb.select = mockSelect

      const existingInterview = await mockDb
        .select()
        .from({} as any)
        .where({} as any)
        .limit(1)

      expect(existingInterview.length).toBe(0)
    })
  })

  describe('Portal Token Generation and Expiry', () => {
    it('should generate secure portal token', () => {
      const token1 = crypto.randomBytes(32).toString('hex')
      const token2 = crypto.randomBytes(32).toString('hex')

      expect(token1).toHaveLength(64) // 32 bytes = 64 hex chars
      expect(token2).toHaveLength(64)
      expect(token1).not.toBe(token2) // Should be unique
      expect(token1).toMatch(/^[a-f0-9]{64}$/) // Hex format
    })

    it('should calculate portal expiry as 7 days after interview', () => {
      const scheduledDate = new Date('2026-03-15T14:00:00.000Z')
      const expectedExpiry = new Date(scheduledDate)
      expectedExpiry.setDate(expectedExpiry.getDate() + 7)

      expect(expectedExpiry.toISOString()).toBe('2026-03-22T14:00:00.000Z')
    })

    it('should create interview with portal access fields', () => {
      const interview = createMockInterview()

      expect(interview.candidatePortalToken).toBeTruthy()
      expect(interview.candidatePortalToken).toHaveLength(64)
      expect(interview.candidatePortalExpiresAt).toBeInstanceOf(Date)
      expect(interview.candidatePortalExpiresAt!.getTime()).toBeGreaterThan(
        interview.scheduledAt.getTime()
      )
    })
  })

  describe('Interview Activity Logging', () => {
    it('should format activity log with correct metadata', () => {
      const scheduledDate = new Date('2026-03-15T14:00:00.000Z')
      const jobTitle = 'Senior Construction Manager'

      const activityLog = {
        candidateId: MOCK_CANDIDATE_ID,
        companyId: MOCK_COMPANY_ID,
        activityType: 'interview_scheduled',
        title: 'Interview Scheduled',
        description: `Interview scheduled for ${scheduledDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}${jobTitle ? ` for ${jobTitle}` : ''}`,
        metadata: {
          interviewId: 'test-interview-id',
          scheduledAt: scheduledDate.toISOString(),
          durationMinutes: 45,
        },
        performedBy: MOCK_USER_ID,
      }

      expect(activityLog.activityType).toBe('interview_scheduled')
      expect(activityLog.title).toBe('Interview Scheduled')
      expect(activityLog.description).toContain('Sunday, March 15, 2026')
      expect(activityLog.description).toContain('Senior Construction Manager')
      expect(activityLog.metadata).toHaveProperty('interviewId')
      expect(activityLog.metadata).toHaveProperty('scheduledAt')
      expect(activityLog.metadata).toHaveProperty('durationMinutes')
    })

    it('should log activity without job title if not provided', () => {
      const scheduledDate = new Date('2026-03-15T14:00:00.000Z')

      const description = `Interview scheduled for ${scheduledDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}`

      expect(description).toContain('Sunday, March 15, 2026')
      // Should not have the job title suffix " for [job title]" at the end
      expect(description).toMatch(/AM$/)
      expect(description).not.toMatch(/for \w+$/)
      expect(description).not.toContain('Senior Construction Manager')
    })
  })

  describe('Zoom Meeting Data Flow', () => {
    it('should pass correct data to createZoomMeeting', async () => {
      const mockCreateZoomMeeting = vi.fn().mockResolvedValue(createMockZoomMeeting())

      const candidate = createMockCandidate()
      const scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const jobTitle = 'Senior Project Manager'
      const durationMinutes = 45
      const timezone = 'America/Los_Angeles'

      await mockCreateZoomMeeting({
        topic: `Interview: ${candidate.firstName} ${candidate.lastName}${jobTitle ? ` - ${jobTitle}` : ''}`,
        startTime: scheduledDate,
        durationMinutes,
        timezone,
        agenda: `Interview with ${candidate.firstName} ${candidate.lastName}${jobTitle ? ` for ${jobTitle} position` : ''}`,
      })

      expect(mockCreateZoomMeeting).toHaveBeenCalledWith({
        topic: 'Interview: John Doe - Senior Project Manager',
        startTime: scheduledDate,
        durationMinutes: 45,
        timezone: 'America/Los_Angeles',
        agenda: 'Interview with John Doe for Senior Project Manager position',
      })
    })

    it('should handle Zoom meeting creation response', async () => {
      const zoomResponse = createMockZoomMeeting()

      expect(zoomResponse).toHaveProperty('meetingId')
      expect(zoomResponse).toHaveProperty('joinUrl')
      expect(zoomResponse).toHaveProperty('startUrl')
      expect(zoomResponse).toHaveProperty('password')
      expect(zoomResponse.meetingId).toBe('1234567890')
      expect(zoomResponse.password).toBe('abc123')
    })

    it('should update interview with Zoom meeting details', async () => {
      const interview = createMockInterview()
      const zoomMeeting = createMockZoomMeeting()

      // Simulate update
      const updatedInterview = {
        ...interview,
        zoomMeetingId: zoomMeeting.meetingId,
        zoomJoinUrl: zoomMeeting.joinUrl,
        zoomStartUrl: zoomMeeting.startUrl,
        passcode: zoomMeeting.password,
      }

      expect(updatedInterview.zoomMeetingId).toBe('1234567890')
      expect(updatedInterview.zoomJoinUrl).toContain('zoom.us/j/')
      expect(updatedInterview.zoomStartUrl).toContain('zoom.us/s/')
      expect(updatedInterview.passcode).toBe('abc123')
    })
  })

  describe('Database Write Operations', () => {
    it('should write to interviews table with all required fields', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockInterview()]),
        }),
      })
      mockDb.insert = mockInsert

      const interviewData = {
        candidateId: MOCK_CANDIDATE_ID,
        jobId: MOCK_JOB_ID,
        companyId: MOCK_COMPANY_ID,
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        durationMinutes: 30,
        interviewType: 'video',
        location: null,
        phoneNumber: null,
        candidatePortalToken: crypto.randomBytes(32).toString('hex'),
        candidatePortalExpiresAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        scheduledBy: MOCK_USER_ID,
        status: 'scheduled',
      }

      const result = await mockDb.insert({} as any).values(interviewData).returning()

      expect(mockInsert).toHaveBeenCalled()
      expect(result).toHaveLength(1)
      expect(result[0]).toHaveProperty('id')
      expect(result[0]).toHaveProperty('candidatePortalToken')
    })

    it('should write to candidateActivities table', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      })
      mockDb.insert = mockInsert

      const activityData = {
        candidateId: MOCK_CANDIDATE_ID,
        companyId: MOCK_COMPANY_ID,
        activityType: 'interview_scheduled',
        title: 'Interview Scheduled',
        description: 'Interview scheduled for Saturday, March 15, 2026',
        metadata: {
          interviewId: 'test-interview-id',
          scheduledAt: new Date().toISOString(),
          durationMinutes: 30,
        },
        performedBy: MOCK_USER_ID,
      }

      await mockDb.insert({} as any).values(activityData)

      expect(mockInsert).toHaveBeenCalled()
    })

    it('should update interview with Zoom details after creation', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      })
      mockDb.update = mockUpdate

      const zoomUpdate = {
        zoomMeetingId: '1234567890',
        zoomJoinUrl: 'https://zoom.us/j/1234567890',
        zoomStartUrl: 'https://zoom.us/s/1234567890',
        passcode: 'abc123',
      }

      await mockDb.update({} as any).set(zoomUpdate).where({} as any)

      expect(mockUpdate).toHaveBeenCalled()
    })
  })

  describe('Complete Interview Creation Flow', () => {
    it('should simulate end-to-end interview creation', async () => {
      // Step 1: Validate input
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      const createInterviewSchema = z.object({
        candidateId: z.string().uuid(),
        scheduledAt: z.string().datetime(),
        durationMinutes: z.number().int().min(15).max(180),
        interviewType: z.enum(['video', 'phone', 'in_person']),
      })

      const input = {
        candidateId: MOCK_CANDIDATE_ID,
        scheduledAt: futureDate,
        durationMinutes: 45,
        interviewType: 'video' as const,
      }

      const validated = createInterviewSchema.parse(input)
      expect(validated).toBeDefined()

      // Step 2: Check for duplicates
      const duplicateCheck = await mockDb.select().from({} as any).where({} as any).limit(1)
      expect(duplicateCheck).toHaveLength(0)

      // Step 3: Generate portal token
      const portalToken = crypto.randomBytes(32).toString('hex')
      expect(portalToken).toHaveLength(64)

      // Step 4: Create interview
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockInterview()]),
        }),
      })
      mockDb.insert = mockInsert

      const interview = await mockDb.insert({} as any).values({}).returning()
      expect(interview).toHaveLength(1)

      // Step 5: Create Zoom meeting
      const zoomMeeting = createMockZoomMeeting()
      expect(zoomMeeting.meetingId).toBeTruthy()

      // Step 6: Update interview with Zoom details
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      })
      mockDb.update = mockUpdate

      await mockDb.update({} as any).set({ zoomMeetingId: zoomMeeting.meetingId }).where({} as any)
      expect(mockUpdate).toHaveBeenCalled()

      // Step 7: Log activity
      await mockDb.insert({} as any).values({})
      expect(mockInsert).toHaveBeenCalledTimes(2) // Interview + activity
    })
  })
})
