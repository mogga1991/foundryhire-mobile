import { vi } from 'vitest'
import * as crypto from 'crypto'
import { interviews, campaigns, campaignSends, candidates, users, companies } from '@/lib/db/schema'

// Infer types from Drizzle schema
type Interview = typeof interviews.$inferSelect
type Campaign = typeof campaigns.$inferSelect
type CampaignSend = typeof campaignSends.$inferSelect
type Candidate = typeof candidates.$inferSelect
type User = typeof users.$inferSelect
type Company = typeof companies.$inferSelect

/**
 * Integration test setup utilities
 * Provides shared mocks and factories for complex object creation
 */

// Mock user ID for testing
export const MOCK_USER_ID = '550e8400-e29b-41d4-a716-446655440000'
export const MOCK_COMPANY_ID = '650e8400-e29b-41d4-a716-446655440001'
export const MOCK_CANDIDATE_ID = '750e8400-e29b-41d4-a716-446655440002'
export const MOCK_JOB_ID = '850e8400-e29b-41d4-a716-446655440003'

/**
 * Create a mock authenticated context
 */
export function createMockAuthContext() {
  return {
    user: {
      id: MOCK_USER_ID,
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: null,
      image: null,
      passwordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User,
    companyId: MOCK_COMPANY_ID,
    company: {
      id: MOCK_COMPANY_ID,
      name: 'Test Company',
      industrySector: 'construction',
      companySize: '10-50',
      website: 'https://test.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Company,
  }
}

/**
 * Create a mock candidate with all required fields
 */
export function createMockCandidate(overrides?: Partial<Candidate>): Candidate {
  const id = overrides?.id || crypto.randomUUID()
  return {
    id,
    companyId: MOCK_COMPANY_ID,
    jobId: MOCK_JOB_ID,
    firstName: 'John',
    lastName: 'Doe',
    email: `john.doe+${id.slice(0, 8)}@example.com`,
    phone: '+12025551234',
    linkedinUrl: null,
    githubUrl: null,
    portfolioUrl: null,
    currentTitle: 'Software Engineer',
    currentCompany: 'Tech Corp',
    location: 'San Francisco, CA',
    experienceYears: 5,
    skills: ['JavaScript', 'React', 'Node.js'],
    resumeUrl: null,
    resumeText: 'Experienced software engineer with 5 years in web development...',
    coverLetter: null,
    source: 'manual',
    status: 'new',
    stage: 'applied',
    aiScore: 75,
    aiScoreBreakdown: null,
    aiSummary: null,
    notes: null,
    appliedAt: null,
    emailVerified: false,
    emailDeliverability: null,
    phoneVerified: false,
    phoneType: null,
    enrichmentScore: 0,
    dataCompleteness: 0,
    enrichedAt: null,
    verifiedAt: null,
    enrichmentSource: null,
    socialProfiles: null,
    companyInfo: null,
    profileImageUrl: null,
    headline: null,
    about: null,
    experience: null,
    education: null,
    certifications: null,
    linkedinScrapedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    enrichmentStatus: 'pending',
    gdprDeletedAt: null,
    ...overrides,
  } as Candidate
}

/**
 * Create a full mock interview with all relations
 */
export function createMockInterview(overrides?: Partial<Interview>): Interview {
  const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
  const portalExpiresAt = new Date(scheduledAt)
  portalExpiresAt.setDate(portalExpiresAt.getDate() + 7)

  return {
    id: crypto.randomUUID(),
    candidateId: MOCK_CANDIDATE_ID,
    jobId: MOCK_JOB_ID,
    companyId: MOCK_COMPANY_ID,
    scheduledAt,
    durationMinutes: 30,
    interviewType: 'video',
    location: null,
    phoneNumber: null,
    zoomMeetingId: '1234567890',
    zoomJoinUrl: 'https://zoom.us/j/1234567890',
    zoomStartUrl: 'https://zoom.us/s/1234567890',
    candidatePortalToken: crypto.randomBytes(32).toString('hex'),
    candidatePortalExpiresAt: portalExpiresAt,
    recordingUrl: null,
    transcript: null,
    aiSummary: null,
    aiSentimentScore: null,
    aiCompetencyScores: null,
    interviewQuestions: null,
    passcode: 'abc123',
    recordingStatus: 'not_started',
    recordingDuration: null,
    recordingFileSize: null,
    recordingProcessedAt: null,
    transcriptStatus: 'pending',
    transcriptProcessedAt: null,
    webhookLastReceivedAt: null,
    webhookEventType: null,
    zoomHostId: null,
    status: 'scheduled',
    cancelReason: null,
    internalNotes: null,
    scheduledBy: MOCK_USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Interview
}

/**
 * Create a full mock campaign with sends
 */
export function createMockCampaign(overrides?: Partial<Campaign>): Campaign {
  return {
    id: crypto.randomUUID(),
    companyId: MOCK_COMPANY_ID,
    jobId: MOCK_JOB_ID,
    emailAccountId: null,
    name: 'Test Campaign',
    subject: 'Join our team at {{company_name}}',
    body: 'Hi {{first_name}}, we found your profile and think you would be a great fit...',
    status: 'draft',
    campaignType: 'outreach',
    scheduledAt: null,
    sentAt: null,
    totalRecipients: 0,
    totalSent: 0,
    totalOpened: 0,
    totalClicked: 0,
    totalReplied: 0,
    totalBounced: 0,
    createdBy: MOCK_USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Campaign
}

/**
 * Create mock campaign sends for a campaign
 */
export function createMockCampaignSends(
  campaignId: string,
  candidateIds: string[],
  overrides?: Partial<CampaignSend>
): CampaignSend[] {
  return candidateIds.map((candidateId) => ({
    id: crypto.randomUUID(),
    campaignId,
    candidateId,
    status: 'pending',
    providerMessageId: null,
    followUpStep: 0,
    sentAt: null,
    openedAt: null,
    clickedAt: null,
    repliedAt: null,
    bouncedAt: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })) as CampaignSend[]
}

/**
 * Create a mock DB with spies for all common operations
 */
export function createMockDb() {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  }
}

/**
 * Create mock Zoom meeting response
 */
export function createMockZoomMeeting() {
  return {
    meetingId: '1234567890',
    joinUrl: 'https://zoom.us/j/1234567890?pwd=abc123',
    startUrl: 'https://zoom.us/s/1234567890?zak=token',
    password: 'abc123',
  }
}

/**
 * Create a mock transcript for testing AI analysis
 */
export function createMockTranscript(options?: {
  length?: 'short' | 'medium' | 'long'
  biased?: boolean
  quality?: 'high' | 'medium' | 'low'
}): string {
  const { length = 'medium', biased = false, quality = 'high' } = options || {}

  const baseTranscript = `
Interviewer: Thank you for joining us today. Can you tell me about your experience with construction management?

Candidate: Thank you for having me. I've been working in construction management for about 8 years now. I started as a site engineer and worked my way up to project manager. I've managed projects ranging from small residential builds to large commercial developments.

Interviewer: That's great experience. Can you describe a challenging project you've worked on and how you handled it?

Candidate: One of the most challenging projects was a mixed-use development with a very tight timeline. We faced some unexpected soil conditions that required design changes. I coordinated with the structural engineer and geotechnical consultants to develop a solution quickly. We also had to manage stakeholder expectations and keep the project on budget despite the changes.

Interviewer: How do you handle conflicts with team members or subcontractors?

Candidate: I believe in addressing issues early and directly. I schedule regular meetings to keep communication open. When conflicts arise, I listen to all parties involved and work to find a solution that addresses everyone's concerns while keeping the project goals in mind.`

  if (biased) {
    return `${baseTranscript}

Interviewer: Are you married? Do you have children?

Candidate: I'm married with two kids.

Interviewer: How old are you? When did you graduate?

Candidate: I'm 35 and graduated in 2010.

Interviewer: What's your native language? I noticed an accent.

Candidate: I'm from Mexico originally, so Spanish is my first language.`
  }

  if (length === 'long') {
    return baseTranscript.repeat(3) + '\n\n[Additional 10 minutes of detailed technical discussion about project management methodologies, safety protocols, and team leadership examples...]'
  }

  if (length === 'short') {
    return baseTranscript.slice(0, 500)
  }

  return baseTranscript
}
