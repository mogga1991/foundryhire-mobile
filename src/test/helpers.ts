/**
 * Test utilities and mock factories for VerticalHire unit tests.
 *
 * Provides consistent mock data builders for candidates, interviews, jobs,
 * and a mock database proxy to prevent real DB access in tests.
 */

// ---------------------------------------------------------------------------
// Mock Data: Candidate
// ---------------------------------------------------------------------------

export interface MockCandidate {
  id: string
  companyId: string
  jobId: string | null
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  currentTitle: string | null
  currentCompany: string | null
  location: string | null
  experienceYears: number | null
  skills: string[] | null
  resumeUrl: string | null
  resumeText: string | null
  status: string
  stage: string
  aiScore: number | null
  source: string
  createdAt: Date
  updatedAt: Date
}

export function createMockCandidate(overrides?: Partial<MockCandidate>): MockCandidate {
  return {
    id: 'cand-001',
    companyId: 'comp-001',
    jobId: 'job-001',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    phone: '+1-555-0100',
    linkedinUrl: 'https://linkedin.com/in/janesmith',
    currentTitle: 'Senior Developer',
    currentCompany: 'Acme Corp',
    location: 'New York, NY',
    experienceYears: 8,
    skills: ['TypeScript', 'React', 'Node.js'],
    resumeUrl: null,
    resumeText: 'Experienced software engineer with 8 years in full-stack development...',
    status: 'active',
    stage: 'screening',
    aiScore: 82,
    source: 'manual',
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Mock Data: Interview
// ---------------------------------------------------------------------------

export interface MockInterview {
  id: string
  candidateId: string
  jobId: string | null
  companyId: string
  scheduledAt: Date
  durationMinutes: number
  interviewType: string
  status: string
  transcript: string | null
  aiSummary: string | null
  aiSentimentScore: number | null
  aiCompetencyScores: Record<string, number> | null
  createdAt: Date
  updatedAt: Date
}

export function createMockInterview(overrides?: Partial<MockInterview>): MockInterview {
  return {
    id: 'int-001',
    candidateId: 'cand-001',
    jobId: 'job-001',
    companyId: 'comp-001',
    scheduledAt: new Date('2025-02-01T10:00:00Z'),
    durationMinutes: 30,
    interviewType: 'video',
    status: 'completed',
    transcript: 'Interviewer: Tell me about your experience.\nCandidate: I have 8 years of experience in software development...',
    aiSummary: 'Strong candidate with extensive experience.',
    aiSentimentScore: 78,
    aiCompetencyScores: { technical: 85, communication: 80, safety: 70, cultureFit: 75 },
    createdAt: new Date('2025-01-20'),
    updatedAt: new Date('2025-02-01'),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Mock Data: Job
// ---------------------------------------------------------------------------

export interface MockJob {
  id: string
  companyId: string
  title: string
  department: string | null
  location: string | null
  employmentType: string | null
  experienceLevel: string | null
  description: string | null
  requirements: string[] | null
  skillsRequired: string[] | null
  status: string
  createdAt: Date
  updatedAt: Date
}

export function createMockJob(overrides?: Partial<MockJob>): MockJob {
  return {
    id: 'job-001',
    companyId: 'comp-001',
    title: 'Senior Software Engineer',
    department: 'Engineering',
    location: 'Remote',
    employmentType: 'full_time',
    experienceLevel: 'senior',
    description: 'We are looking for a senior software engineer...',
    requirements: ['5+ years experience', 'TypeScript proficiency', 'React expertise'],
    skillsRequired: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
    status: 'published',
    createdAt: new Date('2025-01-10'),
    updatedAt: new Date('2025-01-10'),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Mock Database
// ---------------------------------------------------------------------------

/**
 * Creates a mock database object that mirrors Drizzle ORM's query interface.
 * All methods return chainable promises that resolve to empty arrays by default.
 */
export function createMockDb() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    then: vi.fn().mockResolvedValue([]),
  }

  return chainable
}

// ---------------------------------------------------------------------------
// Transcript Generators (for AI tests)
// ---------------------------------------------------------------------------

/**
 * Generates a realistic interview transcript of configurable length.
 */
export function generateMockTranscript(options?: {
  candidateName?: string
  lengthChars?: number
}): string {
  const name = options?.candidateName ?? 'Jane Smith'
  const targetLength = options?.lengthChars ?? 500

  const base = `Interviewer: Good morning ${name}, thanks for joining us today. Can you tell me about your experience?\n\n${name}: Thank you for having me. I have been working in software development for about 8 years, primarily with TypeScript and React. In my current role at Acme Corp, I lead a team of 5 engineers building our core platform.\n\nInterviewer: That sounds great. Can you describe a challenging project you worked on?\n\n${name}: Sure. Last year we had to migrate our entire monolithic application to a microservices architecture. I designed the migration strategy and led the implementation. We completed it in 6 months with zero downtime.\n\nInterviewer: Impressive. How do you handle conflicts within your team?\n\n${name}: I believe in open communication. When conflicts arise, I facilitate discussions where each team member can express their perspective. We focus on the technical merits and find compromises that benefit the project.`

  if (base.length >= targetLength) {
    return base.substring(0, targetLength)
  }

  // Pad if more length is needed
  let result = base
  const padding = '\n\nInterviewer: Can you elaborate more?\n\nCandidate: Certainly, I have extensive experience in this area and can provide additional details about the work we did. '
  while (result.length < targetLength) {
    result += padding
  }
  return result.substring(0, targetLength)
}
