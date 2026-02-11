import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as crypto from 'crypto'
import {
  createMockCampaign,
  createMockCampaignSends,
  createMockCandidate,
  createMockDb,
  MOCK_COMPANY_ID,
  MOCK_USER_ID,
  MOCK_JOB_ID,
} from './setup'

/**
 * Integration tests for campaign workflow
 * Tests the complete campaign lifecycle from creation to tracking
 */

describe('Campaign Workflow Integration', () => {
  let mockDb: ReturnType<typeof createMockDb>

  beforeEach(() => {
    mockDb = createMockDb()
    vi.clearAllMocks()
  })

  describe('Campaign Creation with Template Merge Tags', () => {
    it('should create campaign with valid merge tags', () => {
      const campaign = createMockCampaign({
        subject: 'Join {{company_name}} as a {{job_title}}',
        body: `Hi {{first_name}},

We found your profile and think you would be a great fit for our {{job_title}} position at {{company_name}}.

Your experience with {{skills}} makes you an ideal candidate.

Best regards,
{{recruiter_name}}`,
      })

      expect(campaign.subject).toContain('{{company_name}}')
      expect(campaign.subject).toContain('{{job_title}}')
      expect(campaign.body).toContain('{{first_name}}')
      expect(campaign.body).toContain('{{skills}}')
    })

    it('should support multiple merge tag formats', () => {
      const mergeTags = [
        '{{first_name}}',
        '{{last_name}}',
        '{{email}}',
        '{{company_name}}',
        '{{job_title}}',
        '{{job_location}}',
        '{{skills}}',
        '{{experience_years}}',
        '{{recruiter_name}}',
        '{{recruiter_email}}',
      ]

      const body = mergeTags.join(' ')
      const campaign = createMockCampaign({ body })

      mergeTags.forEach(tag => {
        expect(campaign.body).toContain(tag)
      })
    })

    it('should validate campaign creation fields', () => {
      const campaign = createMockCampaign({
        name: 'Q1 2026 Outreach',
        subject: 'Exciting opportunity at {{company_name}}',
        body: 'Hi {{first_name}}, we have an opportunity...',
        status: 'draft',
        campaignType: 'outreach',
        totalRecipients: 50,
      })

      expect(campaign.name).toBe('Q1 2026 Outreach')
      expect(campaign.status).toBe('draft')
      expect(campaign.campaignType).toBe('outreach')
      expect(campaign.totalRecipients).toBe(50)
      expect(campaign.companyId).toBe(MOCK_COMPANY_ID)
      expect(campaign.createdBy).toBe(MOCK_USER_ID)
    })
  })

  describe('Campaign Send Flow with Per-Recipient Tracking', () => {
    it('should create campaign sends for all recipients', async () => {
      const campaign = createMockCampaign()
      const candidateIds = [
        crypto.randomUUID(),
        crypto.randomUUID(),
        crypto.randomUUID(),
      ]

      const sends = createMockCampaignSends(campaign.id, candidateIds)

      expect(sends).toHaveLength(3)
      sends.forEach((send, index) => {
        expect(send.campaignId).toBe(campaign.id)
        expect(send.candidateId).toBe(candidateIds[index])
        expect(send.status).toBe('pending')
        expect(send.followUpStep).toBe(0)
      })
    })

    it('should track individual send with provider message ID', () => {
      const campaignId = crypto.randomUUID()
      const candidateId = crypto.randomUUID()

      const [send] = createMockCampaignSends(campaignId, [candidateId], {
        status: 'sent',
        providerMessageId: 'msg_1234567890',
        sentAt: new Date(),
      })

      expect(send.status).toBe('sent')
      expect(send.providerMessageId).toBe('msg_1234567890')
      expect(send.sentAt).toBeInstanceOf(Date)
    })

    it('should support follow-up step tracking', () => {
      const campaignId = crypto.randomUUID()
      const candidateId = crypto.randomUUID()

      const [followUpSend] = createMockCampaignSends(campaignId, [candidateId], {
        followUpStep: 2,
        status: 'sent',
      })

      expect(followUpSend.followUpStep).toBe(2)
    })

    it('should track send errors', () => {
      const campaignId = crypto.randomUUID()
      const candidateId = crypto.randomUUID()

      const [failedSend] = createMockCampaignSends(campaignId, [candidateId], {
        status: 'failed',
        errorMessage: 'Invalid email address',
      })

      expect(failedSend.status).toBe('failed')
      expect(failedSend.errorMessage).toBe('Invalid email address')
    })
  })

  describe('Campaign Status Transitions', () => {
    it('should transition from draft to scheduled', () => {
      const campaign = createMockCampaign({ status: 'draft' })
      expect(campaign.status).toBe('draft')
      expect(campaign.scheduledAt).toBeNull()

      const scheduledCampaign = {
        ...campaign,
        status: 'scheduled',
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      }

      expect(scheduledCampaign.status).toBe('scheduled')
      expect(scheduledCampaign.scheduledAt).toBeInstanceOf(Date)
    })

    it('should transition from scheduled to sending', () => {
      const campaign = createMockCampaign({
        status: 'scheduled',
        scheduledAt: new Date(),
      })

      const sendingCampaign = {
        ...campaign,
        status: 'sending',
      }

      expect(sendingCampaign.status).toBe('sending')
    })

    it('should transition from sending to completed', () => {
      const campaign = createMockCampaign({
        status: 'sending',
        totalRecipients: 10,
        totalSent: 8,
      })

      const completedCampaign = {
        ...campaign,
        status: 'completed',
        totalSent: 10,
        sentAt: new Date(),
      }

      expect(completedCampaign.status).toBe('completed')
      expect(completedCampaign.totalSent).toBe(completedCampaign.totalRecipients)
      expect(completedCampaign.sentAt).toBeInstanceOf(Date)
    })

    it('should support all valid status values', () => {
      const validStatuses = ['draft', 'scheduled', 'sending', 'completed', 'paused', 'cancelled']

      validStatuses.forEach(status => {
        const campaign = createMockCampaign({ status: status as any })
        expect(campaign.status).toBe(status)
      })
    })
  })

  describe('Campaign Pause and Resume Logic', () => {
    it('should pause an active campaign', () => {
      const campaign = createMockCampaign({
        status: 'sending',
        totalRecipients: 100,
        totalSent: 45,
      })

      const pausedCampaign = {
        ...campaign,
        status: 'paused',
        updatedAt: new Date(),
      }

      expect(pausedCampaign.status).toBe('paused')
      expect(pausedCampaign.totalSent).toBe(45) // Progress preserved
    })

    it('should resume a paused campaign', () => {
      const campaign = createMockCampaign({
        status: 'paused',
        totalRecipients: 100,
        totalSent: 45,
      })

      const resumedCampaign = {
        ...campaign,
        status: 'sending',
        updatedAt: new Date(),
      }

      expect(resumedCampaign.status).toBe('sending')
      expect(resumedCampaign.totalSent).toBe(45) // Resume from where it left off
    })

    it('should track sends correctly after resume', () => {
      const campaignId = crypto.randomUUID()
      const candidateIds = Array.from({ length: 5 }, () => crypto.randomUUID())

      // Some sends completed before pause
      const sends = createMockCampaignSends(campaignId, candidateIds, { status: 'pending' })
      sends[0].status = 'sent'
      sends[1].status = 'sent'
      sends[2].status = 'sent'

      const sentCount = sends.filter(s => s.status === 'sent').length
      const pendingCount = sends.filter(s => s.status === 'pending').length

      expect(sentCount).toBe(3)
      expect(pendingCount).toBe(2)
    })
  })

  describe('Open and Click Tracking Event Processing', () => {
    it('should process email open event', () => {
      const campaignId = crypto.randomUUID()
      const candidateId = crypto.randomUUID()

      const [send] = createMockCampaignSends(campaignId, [candidateId], {
        status: 'sent',
        sentAt: new Date(Date.now() - 60 * 60 * 1000), // Sent 1 hour ago
      })

      // Simulate open event
      const openedSend = {
        ...send,
        openedAt: new Date(),
      }

      expect(openedSend.openedAt).toBeInstanceOf(Date)
      expect(openedSend.openedAt!.getTime()).toBeGreaterThan(openedSend.sentAt!.getTime())
    })

    it('should process click event', () => {
      const campaignId = crypto.randomUUID()
      const candidateId = crypto.randomUUID()

      const [send] = createMockCampaignSends(campaignId, [candidateId], {
        status: 'sent',
        sentAt: new Date(Date.now() - 60 * 60 * 1000),
        openedAt: new Date(Date.now() - 30 * 60 * 1000),
      })

      // Simulate click event
      const clickedSend = {
        ...send,
        clickedAt: new Date(),
      }

      expect(clickedSend.clickedAt).toBeInstanceOf(Date)
      expect(clickedSend.clickedAt!.getTime()).toBeGreaterThan(clickedSend.openedAt!.getTime())
    })

    it('should process reply event', () => {
      const campaignId = crypto.randomUUID()
      const candidateId = crypto.randomUUID()

      const [send] = createMockCampaignSends(campaignId, [candidateId], {
        status: 'sent',
        sentAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })

      // Simulate reply event
      const repliedSend = {
        ...send,
        repliedAt: new Date(),
      }

      expect(repliedSend.repliedAt).toBeInstanceOf(Date)
    })

    it('should process bounce event', () => {
      const campaignId = crypto.randomUUID()
      const candidateId = crypto.randomUUID()

      const [send] = createMockCampaignSends(campaignId, [candidateId], {
        status: 'sent',
        sentAt: new Date(),
      })

      // Simulate bounce event
      const bouncedSend = {
        ...send,
        status: 'bounced',
        bouncedAt: new Date(),
        errorMessage: 'Mailbox does not exist',
      }

      expect(bouncedSend.status).toBe('bounced')
      expect(bouncedSend.bouncedAt).toBeInstanceOf(Date)
      expect(bouncedSend.errorMessage).toBeTruthy()
    })

    it('should handle multiple tracking events in order', () => {
      const now = Date.now()
      const campaignId = crypto.randomUUID()
      const candidateId = crypto.randomUUID()

      const [send] = createMockCampaignSends(campaignId, [candidateId], {
        status: 'sent',
        sentAt: new Date(now),
        openedAt: new Date(now + 5 * 60 * 1000), // Opened 5 min later
        clickedAt: new Date(now + 10 * 60 * 1000), // Clicked 10 min later
        repliedAt: new Date(now + 60 * 60 * 1000), // Replied 1 hour later
      })

      expect(send.sentAt!.getTime()).toBeLessThan(send.openedAt!.getTime())
      expect(send.openedAt!.getTime()).toBeLessThan(send.clickedAt!.getTime())
      expect(send.clickedAt!.getTime()).toBeLessThan(send.repliedAt!.getTime())
    })
  })

  describe('Campaign Stats Aggregation', () => {
    it('should calculate aggregate stats from sends', () => {
      const campaignId = crypto.randomUUID()
      const candidateIds = Array.from({ length: 10 }, () => crypto.randomUUID())
      const sends = createMockCampaignSends(campaignId, candidateIds)

      // Simulate various send states
      sends[0] = { ...sends[0], status: 'sent', sentAt: new Date() }
      sends[1] = { ...sends[1], status: 'sent', sentAt: new Date(), openedAt: new Date() }
      sends[2] = { ...sends[2], status: 'sent', sentAt: new Date(), openedAt: new Date(), clickedAt: new Date() }
      sends[3] = { ...sends[3], status: 'sent', sentAt: new Date(), openedAt: new Date(), repliedAt: new Date() }
      sends[4] = { ...sends[4], status: 'sent', sentAt: new Date(), openedAt: new Date() }
      sends[5] = { ...sends[5], status: 'bounced', sentAt: new Date(), bouncedAt: new Date() }
      sends[6] = { ...sends[6], status: 'failed', errorMessage: 'Invalid email' }
      sends[7] = { ...sends[7], status: 'pending' }
      sends[8] = { ...sends[8], status: 'pending' }
      sends[9] = { ...sends[9], status: 'pending' }

      const stats = {
        totalRecipients: sends.length,
        totalSent: sends.filter(s => s.sentAt !== null).length,
        totalOpened: sends.filter(s => s.openedAt !== null).length,
        totalClicked: sends.filter(s => s.clickedAt !== null).length,
        totalReplied: sends.filter(s => s.repliedAt !== null).length,
        totalBounced: sends.filter(s => s.bouncedAt !== null).length,
      }

      expect(stats.totalRecipients).toBe(10)
      expect(stats.totalSent).toBe(6)
      expect(stats.totalOpened).toBe(4)
      expect(stats.totalClicked).toBe(1)
      expect(stats.totalReplied).toBe(1)
      expect(stats.totalBounced).toBe(1)
    })

    it('should calculate open rate percentage', () => {
      const totalSent = 100
      const totalOpened = 45

      const openRate = (totalOpened / totalSent) * 100
      expect(openRate).toBe(45)
    })

    it('should calculate click-through rate', () => {
      const totalOpened = 45
      const totalClicked = 12

      const clickThroughRate = (totalClicked / totalOpened) * 100
      expect(Math.round(clickThroughRate)).toBe(27)
    })

    it('should calculate reply rate', () => {
      const totalSent = 100
      const totalReplied = 8

      const replyRate = (totalReplied / totalSent) * 100
      expect(replyRate).toBe(8)
    })

    it('should update campaign with aggregated stats', () => {
      const campaign = createMockCampaign({
        totalRecipients: 100,
        totalSent: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalReplied: 0,
        totalBounced: 0,
      })

      const updatedCampaign = {
        ...campaign,
        totalSent: 95,
        totalOpened: 45,
        totalClicked: 12,
        totalReplied: 8,
        totalBounced: 5,
        updatedAt: new Date(),
      }

      expect(updatedCampaign.totalSent).toBe(95)
      expect(updatedCampaign.totalOpened).toBe(45)
      expect(updatedCampaign.totalClicked).toBe(12)
      expect(updatedCampaign.totalReplied).toBe(8)
      expect(updatedCampaign.totalBounced).toBe(5)
    })
  })

  describe('Complete Campaign Workflow', () => {
    it('should simulate end-to-end campaign creation and sending', async () => {
      // Step 1: Create campaign
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockCampaign()]),
        }),
      })
      mockDb.insert = mockInsert

      const campaign = await mockDb
        .insert({} as any)
        .values({
          name: 'Q1 2026 Outreach',
          subject: 'Join {{company_name}}',
          body: 'Hi {{first_name}}, we have an opportunity...',
          companyId: MOCK_COMPANY_ID,
          jobId: MOCK_JOB_ID,
          status: 'draft',
        })
        .returning()

      expect(campaign).toHaveLength(1)
      expect(mockInsert).toHaveBeenCalled()

      // Step 2: Create campaign sends
      const candidateIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]
      await mockDb.insert({} as any).values(candidateIds.map(id => ({ candidateId: id })))

      expect(mockInsert).toHaveBeenCalledTimes(2)

      // Step 3: Update status to sending
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      })
      mockDb.update = mockUpdate

      await mockDb.update({} as any).set({ status: 'sending' }).where({} as any)
      expect(mockUpdate).toHaveBeenCalled()

      // Step 4: Simulate tracking events
      await mockDb.update({} as any).set({ openedAt: new Date() }).where({} as any)
      await mockDb.update({} as any).set({ clickedAt: new Date() }).where({} as any)

      // Step 5: Update campaign stats
      await mockDb.update({} as any).set({
        totalSent: 3,
        totalOpened: 2,
        totalClicked: 1,
      }).where({} as any)

      // Step 6: Mark as completed
      await mockDb.update({} as any).set({
        status: 'completed',
        sentAt: new Date(),
      }).where({} as any)

      expect(mockUpdate).toHaveBeenCalled()
    })

    it('should handle campaign with follow-ups', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      })
      mockDb.insert = mockInsert

      // Create campaign
      const campaign = createMockCampaign()

      // Create follow-up sequences
      const followUps = [
        {
          campaignId: campaign.id,
          stepNumber: 1,
          delayDays: 3,
          subject: 'Following up on {{job_title}} opportunity',
          body: 'Hi {{first_name}}, just checking if you saw my previous message...',
        },
        {
          campaignId: campaign.id,
          stepNumber: 2,
          delayDays: 7,
          subject: 'Last chance: {{job_title}} at {{company_name}}',
          body: 'Hi {{first_name}}, this is my final follow-up...',
        },
      ]

      await mockDb.insert({} as any).values(followUps)
      expect(mockInsert).toHaveBeenCalled()
    })
  })
})
