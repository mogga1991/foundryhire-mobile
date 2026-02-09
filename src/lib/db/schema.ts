import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

// =============================================================================
// NextAuth.js required tables
// =============================================================================

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
  sessionState: text('session_state'),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionToken: text('session_token').notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
})

export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull().unique(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
})

// =============================================================================
// Business tables
// =============================================================================

export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  industrySector: text('industry_sector'),
  companySize: text('company_size'),
  website: text('website'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const companyUsers = pgTable('company_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('recruiter'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('company_users_company_user_idx').on(table.companyId, table.userId),
])

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }).unique(),
  plan: text('plan').notNull().default('starter'),
  status: text('status').notNull().default('active'),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  jobPostsLimit: integer('job_posts_limit').notNull().default(3),
  aiCreditsLimit: integer('ai_credits_limit').notNull().default(100),
  aiCreditsUsed: integer('ai_credits_used').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const jobs = pgTable('jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  department: text('department'),
  location: text('location'),
  employmentType: text('employment_type'),
  experienceLevel: text('experience_level'),
  salaryMin: integer('salary_min'),
  salaryMax: integer('salary_max'),
  salaryCurrency: text('salary_currency').default('USD'),
  description: text('description'),
  requirements: text('requirements').array(),
  responsibilities: text('responsibilities').array(),
  benefits: text('benefits').array(),
  skillsRequired: text('skills_required').array(),
  skillsPreferred: text('skills_preferred').array(),
  status: text('status').notNull().default('draft'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  closesAt: timestamp('closes_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('jobs_company_id_idx').on(table.companyId),
  index('jobs_status_idx').on(table.status),
])

export const candidates = pgTable('candidates', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  linkedinUrl: text('linkedin_url'),
  githubUrl: text('github_url'),
  portfolioUrl: text('portfolio_url'),
  currentTitle: text('current_title'),
  currentCompany: text('current_company'),
  location: text('location'),
  experienceYears: integer('experience_years'),
  skills: text('skills').array(),
  resumeUrl: text('resume_url'),
  resumeText: text('resume_text'),
  coverLetter: text('cover_letter'),
  source: text('source').default('manual'),
  status: text('status').notNull().default('new'),
  stage: text('stage').notNull().default('applied'),
  aiScore: integer('ai_score'),
  aiScoreBreakdown: jsonb('ai_score_breakdown'),
  aiSummary: text('ai_summary'),
  notes: text('notes'),
  appliedAt: timestamp('applied_at', { withTimezone: true }),
  // Enrichment & Verification Fields
  emailVerified: boolean('email_verified').default(false),
  emailDeliverability: text('email_deliverability'), // deliverable, undeliverable, risky, unknown
  phoneVerified: boolean('phone_verified').default(false),
  phoneType: text('phone_type'), // mobile, landline, voip, unknown
  enrichmentScore: integer('enrichment_score').default(0), // 0-100
  dataCompleteness: integer('data_completeness').default(0), // 0-100
  enrichedAt: timestamp('enriched_at', { withTimezone: true }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  enrichmentSource: text('enrichment_source'), // hunter, peopledatalabs, clearbit, etc.
  socialProfiles: jsonb('social_profiles'), // { twitter, github, linkedin }
  companyInfo: jsonb('company_info'), // { name, domain, size, industry }
  // Rich Profile Fields (from LinkedIn profile scraping)
  profileImageUrl: text('profile_image_url'),
  headline: text('headline'), // Professional headline
  about: text('about'), // LinkedIn about/summary section
  experience: jsonb('experience'), // Array<{title, company, location, startDate, endDate, duration, description, isCurrent}>
  education: jsonb('education'), // Array<{school, degree, fieldOfStudy, startDate, endDate}>
  certifications: jsonb('certifications'), // Array<{name, issuingOrganization, issueDate}>
  linkedinScrapedAt: timestamp('linkedin_scraped_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  // Enrichment status for progressive enrichment
  enrichmentStatus: text('enrichment_status').default('pending'), // pending, partial, complete, failed
}, (table) => [
  index('candidates_company_id_idx').on(table.companyId),
  index('candidates_job_id_idx').on(table.jobId),
  index('candidates_status_idx').on(table.status),
  index('candidates_email_verified_idx').on(table.emailVerified),
  index('candidates_enrichment_score_idx').on(table.enrichmentScore),
  uniqueIndex('candidates_company_email_idx')
    .on(table.companyId, table.email)
    .where(sql`email IS NOT NULL`),
  uniqueIndex('candidates_company_linkedin_idx')
    .on(table.companyId, table.linkedinUrl)
    .where(sql`linkedin_url IS NOT NULL`),
])

export const campaigns = pgTable('campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
  emailAccountId: uuid('email_account_id'),
  name: text('name').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull().default('draft'),
  campaignType: text('campaign_type').notNull().default('outreach'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  totalRecipients: integer('total_recipients').notNull().default(0),
  totalSent: integer('total_sent').notNull().default(0),
  totalOpened: integer('total_opened').notNull().default(0),
  totalClicked: integer('total_clicked').notNull().default(0),
  totalReplied: integer('total_replied').notNull().default(0),
  totalBounced: integer('total_bounced').notNull().default(0),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('campaigns_company_id_idx').on(table.companyId),
  index('campaigns_job_id_idx').on(table.jobId),
])

export const campaignSends = pgTable('campaign_sends', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  candidateId: uuid('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),
  providerMessageId: text('provider_message_id'),
  followUpStep: integer('follow_up_step').notNull().default(0),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  clickedAt: timestamp('clicked_at', { withTimezone: true }),
  repliedAt: timestamp('replied_at', { withTimezone: true }),
  bouncedAt: timestamp('bounced_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('campaign_sends_campaign_id_idx').on(table.campaignId),
  index('campaign_sends_candidate_id_idx').on(table.candidateId),
])

export const candidateActivities = pgTable('candidate_activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  candidateId: uuid('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  activityType: text('activity_type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  metadata: jsonb('metadata'),
  performedBy: uuid('performed_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('candidate_activities_candidate_id_idx').on(table.candidateId),
  index('candidate_activities_company_id_idx').on(table.companyId),
])

export const candidateReminders = pgTable('candidate_reminders', {
  id: uuid('id').defaultRandom().primaryKey(),
  candidateId: uuid('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  isCompleted: boolean('is_completed').notNull().default(false),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('candidate_reminders_candidate_id_idx').on(table.candidateId),
])

// =============================================================================
// API Usage Tracking (for free tier limits)
// =============================================================================

export const apiUsage = pgTable('api_usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  month: text('month').notNull(), // Format: YYYY-MM

  // Apify (Paid - limited to 50/month for testing)
  apifyLeads: integer('apify_leads').default(0).notNull(),

  // Apollo.io (Free tier: 50/month)
  apolloCalls: integer('apollo_calls').default(0).notNull(),

  // Lusha (Free tier: 50/month)
  lushaCalls: integer('lusha_calls').default(0).notNull(),

  // Coresignal (Trial: 100/month)
  coresignalCalls: integer('coresignal_calls').default(0).notNull(),

  // Proxycurl (Trial: 100/month, 2 req/minute)
  proxycurlCalls: integer('proxycurl_calls').default(0).notNull(),

  // Indeed (via Apify)
  indeedLeads: integer('indeed_leads').default(0).notNull(),

  // GitHub API searches
  githubSearches: integer('github_searches').default(0).notNull(),

  // CSV imports
  csvImports: integer('csv_imports').default(0).notNull(),

  // Total estimated cost for the month
  totalCost: integer('total_cost').default(0).notNull(), // In cents

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('api_usage_company_month_idx').on(table.companyId, table.month),
])

// =============================================================================
// Enrichment Queue (for progressive enrichment)
// =============================================================================

export const enrichmentQueue = pgTable('enrichment_queue', {
  id: uuid('id').defaultRandom().primaryKey(),
  candidateId: uuid('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),

  // What needs enriching: email_find, email_verify, phone_find, phone_verify,
  // linkedin_profile, company_info, ai_score
  enrichmentType: text('enrichment_type').notNull(),

  // Queue management
  status: text('status').notNull().default('pending'), // pending, in_progress, completed, failed, skipped
  priority: integer('priority').notNull().default(5), // 1=highest, 10=lowest

  // Retry logic
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  lastError: text('last_error'),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),

  // Completion
  result: jsonb('result'),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('enrichment_queue_candidate_idx').on(table.candidateId),
  index('enrichment_queue_status_idx').on(table.status),
  index('enrichment_queue_next_attempt_idx').on(table.nextAttemptAt),
  index('enrichment_queue_priority_idx').on(table.priority, table.nextAttemptAt),
])

// =============================================================================
// Email Infrastructure
// =============================================================================

export const emailAccounts = pgTable('email_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // esp, gmail_oauth, microsoft_oauth, smtp
  displayName: text('display_name').notNull(),
  fromAddress: text('from_address').notNull(),
  fromName: text('from_name'),
  status: text('status').notNull().default('pending'), // pending, active, error, disconnected
  capabilities: jsonb('capabilities').$type<{
    supportsInbound: boolean
    supportsWebhooks: boolean
    supportsThreading: boolean
    maxDailyLimit?: number
  }>().default({ supportsInbound: false, supportsWebhooks: false, supportsThreading: false }),
  isDefault: boolean('is_default').default(false),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('email_accounts_company_id_idx').on(table.companyId),
  index('email_accounts_type_idx').on(table.type),
])

export const emailAccountSecrets = pgTable('email_account_secrets', {
  id: uuid('id').defaultRandom().primaryKey(),
  emailAccountId: uuid('email_account_id').notNull().references(() => emailAccounts.id, { onDelete: 'cascade' }).unique(),
  encryptedData: text('encrypted_data').notNull(),
  encryptionVersion: integer('encryption_version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const domainIdentities = pgTable('domain_identities', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  domain: text('domain').notNull(),
  resendDomainId: text('resend_domain_id'),
  dkimStatus: text('dkim_status').notNull().default('pending'), // pending, verified, failed
  spfStatus: text('spf_status').notNull().default('pending'),
  dkimRecords: jsonb('dkim_records'),
  spfRecord: text('spf_record'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  trackingDomain: text('tracking_domain'),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('domain_identities_company_id_idx').on(table.companyId),
  uniqueIndex('domain_identities_domain_idx').on(table.domain),
])

export const emailQueue = pgTable('email_queue', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  emailAccountId: uuid('email_account_id').references(() => emailAccounts.id, { onDelete: 'set null' }),
  campaignSendId: uuid('campaign_send_id').references(() => campaignSends.id, { onDelete: 'set null' }),
  fromAddress: text('from_address').notNull(),
  fromName: text('from_name'),
  toAddress: text('to_address').notNull(),
  subject: text('subject').notNull(),
  htmlBody: text('html_body').notNull(),
  textBody: text('text_body'),
  replyTo: text('reply_to'),
  headers: jsonb('headers'),
  status: text('status').notNull().default('pending'), // pending, in_progress, sent, failed, cancelled
  priority: integer('priority').notNull().default(5),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  lastError: text('last_error'),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).defaultNow(),
  providerMessageId: text('provider_message_id'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('email_queue_status_idx').on(table.status),
  index('email_queue_next_attempt_idx').on(table.nextAttemptAt),
  index('email_queue_priority_idx').on(table.priority, table.nextAttemptAt),
  index('email_queue_campaign_send_idx').on(table.campaignSendId),
  index('email_queue_company_idx').on(table.companyId),
])

export const emailSuppressions = pgTable('email_suppressions', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  reason: text('reason').notNull(), // unsubscribe, bounce, complaint, manual
  source: text('source'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('email_suppressions_company_email_idx').on(table.companyId, table.email),
])

// Candidate Users - separate from candidates table (which are job applicants)
// This table stores candidate user accounts for candidate portal authentication
export const candidateUsers = pgTable('candidate_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  emailVerified: boolean('email_verified').default(false),
  verificationToken: text('verification_token'),
  verificationTokenExpiry: timestamp('verification_token_expiry', { withTimezone: true }),
  resetPasswordToken: text('reset_password_token'),
  resetPasswordExpiry: timestamp('reset_password_expiry', { withTimezone: true }),
  profileImageUrl: text('profile_image_url'),
  phone: text('phone'),
  location: text('location'),
  currentTitle: text('current_title'),
  currentCompany: text('current_company'),
  linkedinUrl: text('linkedin_url'),
  resumeUrl: text('resume_url'),
  bio: text('bio'),
  skills: text('skills').array(),
  experienceYears: integer('experience_years'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('candidate_users_email_idx').on(table.email),
])

export const campaignFollowUps = pgTable('campaign_follow_ups', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  stepNumber: integer('step_number').notNull(),
  delayDays: integer('delay_days').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('campaign_follow_ups_campaign_idx').on(table.campaignId),
  uniqueIndex('campaign_follow_ups_campaign_step_idx').on(table.campaignId, table.stepNumber),
])

// =============================================================================
// Interview System
// =============================================================================

export const interviews = pgTable('interviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  candidateId: uuid('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade' }),
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),

  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  durationMinutes: integer('duration_minutes').default(30),

  // Interview Type & Location
  interviewType: text('interview_type').notNull().default('video'), // video, phone, in_person
  location: text('location'), // For in-person interviews (address or meeting room)
  phoneNumber: text('phone_number'), // For phone interviews

  // Zoom Integration
  zoomMeetingId: text('zoom_meeting_id'),
  zoomJoinUrl: text('zoom_join_url'),
  zoomStartUrl: text('zoom_start_url'),

  // Portal Access
  candidatePortalToken: text('candidate_portal_token').unique(),
  candidatePortalExpiresAt: timestamp('candidate_portal_expires_at', { withTimezone: true }),

  // Recording & Transcript
  recordingUrl: text('recording_url'),
  transcript: text('transcript'),

  // AI Analysis
  aiSummary: text('ai_summary'),
  aiSentimentScore: integer('ai_sentiment_score'), // 0-100
  aiCompetencyScores: jsonb('ai_competency_scores').$type<{
    technical: number;
    communication: number;
    safety: number;
    cultureFit: number;
  }>(),

  // Interview Questions (for the sidebar question list inspired by reference UI)
  interviewQuestions: jsonb('interview_questions').$type<Array<{
    id: string;
    question: string;
    answer?: string;
    completed: boolean;
  }>>(),

  status: text('status').notNull().default('scheduled'), // scheduled, confirmed, in_progress, completed, cancelled, no_show
  cancelReason: text('cancel_reason'),

  scheduledBy: uuid('scheduled_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('interviews_candidate_id_idx').on(table.candidateId),
  index('interviews_company_id_idx').on(table.companyId),
  index('interviews_job_id_idx').on(table.jobId),
  index('interviews_status_idx').on(table.status),
  index('interviews_scheduled_at_idx').on(table.scheduledAt),
])

export const interviewFeedback = pgTable('interview_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  interviewId: uuid('interview_id').notNull().references(() => interviews.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  rating: integer('rating').notNull(), // 1-10
  feedbackText: text('feedback_text'),
  recommendation: text('recommendation'), // strong_hire, hire, maybe, no_hire, strong_no_hire

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('interview_feedback_interview_id_idx').on(table.interviewId),
])

export const interviewTimeSlots = pgTable('interview_time_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  interviewId: uuid('interview_id').references(() => interviews.id, { onDelete: 'cascade' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  candidateId: uuid('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade' }),

  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),

  aiOptimalityScore: integer('ai_optimality_score'), // 0-100
  aiReasoning: text('ai_reasoning'),

  status: text('status').notNull().default('suggested'), // suggested, selected, rejected

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('interview_time_slots_company_id_idx').on(table.companyId),
  index('interview_time_slots_candidate_id_idx').on(table.candidateId),
])

export const interviewParticipants = pgTable('interview_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  interviewId: uuid('interview_id').notNull().references(() => interviews.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  role: text('role').notNull().default('interviewer'), // interviewer, observer, recruiter
  isRequired: boolean('is_required').notNull().default(true),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('interview_participants_interview_id_idx').on(table.interviewId),
  index('interview_participants_user_id_idx').on(table.userId),
  uniqueIndex('interview_participants_interview_user_idx').on(table.interviewId, table.userId),
])

export const interviewReminders = pgTable('interview_reminders', {
  id: uuid('id').primaryKey().defaultRandom(),
  interviewId: uuid('interview_id').notNull().references(() => interviews.id, { onDelete: 'cascade' }),

  recipientType: text('recipient_type').notNull(), // candidate, interviewer
  recipientEmail: text('recipient_email').notNull(),
  recipientUserId: uuid('recipient_user_id').references(() => users.id, { onDelete: 'cascade' }),

  reminderType: text('reminder_type').notNull(), // 24h_before, 2h_before, 15min_before, custom
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),

  status: text('status').notNull().default('pending'), // pending, sent, failed
  sentAt: timestamp('sent_at', { withTimezone: true }),
  errorMessage: text('error_message'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('interview_reminders_interview_id_idx').on(table.interviewId),
  index('interview_reminders_scheduled_for_idx').on(table.scheduledFor),
  index('interview_reminders_status_idx').on(table.status),
])

// =============================================================================
// Relations (for Drizzle relational queries)
// =============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  companyUsers: many(companyUsers),
  accounts: many(accounts),
  sessions: many(sessions),
}))

export const companiesRelations = relations(companies, ({ many, one }) => ({
  companyUsers: many(companyUsers),
  subscription: one(subscriptions, { fields: [companies.id], references: [subscriptions.companyId] }),
  jobs: many(jobs),
  candidates: many(candidates),
  campaigns: many(campaigns),
  apiUsage: many(apiUsage),
  emailAccounts: many(emailAccounts),
  domainIdentities: many(domainIdentities),
  emailSuppressions: many(emailSuppressions),
}))

export const companyUsersRelations = relations(companyUsers, ({ one }) => ({
  company: one(companies, { fields: [companyUsers.companyId], references: [companies.id] }),
  user: one(users, { fields: [companyUsers.userId], references: [users.id] }),
}))

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  company: one(companies, { fields: [subscriptions.companyId], references: [companies.id] }),
}))

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  company: one(companies, { fields: [jobs.companyId], references: [companies.id] }),
  creator: one(users, { fields: [jobs.createdBy], references: [users.id] }),
  candidates: many(candidates),
  campaigns: many(campaigns),
}))

export const candidatesRelations = relations(candidates, ({ one, many }) => ({
  company: one(companies, { fields: [candidates.companyId], references: [companies.id] }),
  job: one(jobs, { fields: [candidates.jobId], references: [jobs.id] }),
  activities: many(candidateActivities),
  reminders: many(candidateReminders),
  campaignSends: many(campaignSends),
  enrichmentTasks: many(enrichmentQueue),
  interviews: many(interviews),
}))

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  company: one(companies, { fields: [campaigns.companyId], references: [companies.id] }),
  job: one(jobs, { fields: [campaigns.jobId], references: [jobs.id] }),
  emailAccount: one(emailAccounts, { fields: [campaigns.emailAccountId], references: [emailAccounts.id] }),
  sends: many(campaignSends),
  followUps: many(campaignFollowUps),
}))

export const campaignSendsRelations = relations(campaignSends, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignSends.campaignId], references: [campaigns.id] }),
  candidate: one(candidates, { fields: [campaignSends.candidateId], references: [candidates.id] }),
}))

export const candidateActivitiesRelations = relations(candidateActivities, ({ one }) => ({
  candidate: one(candidates, { fields: [candidateActivities.candidateId], references: [candidates.id] }),
  company: one(companies, { fields: [candidateActivities.companyId], references: [companies.id] }),
  performer: one(users, { fields: [candidateActivities.performedBy], references: [users.id] }),
}))

export const candidateRemindersRelations = relations(candidateReminders, ({ one }) => ({
  candidate: one(candidates, { fields: [candidateReminders.candidateId], references: [candidates.id] }),
  company: one(companies, { fields: [candidateReminders.companyId], references: [companies.id] }),
  creator: one(users, { fields: [candidateReminders.createdBy], references: [users.id] }),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const apiUsageRelations = relations(apiUsage, ({ one }) => ({
  company: one(companies, { fields: [apiUsage.companyId], references: [companies.id] }),
}))

export const enrichmentQueueRelations = relations(enrichmentQueue, ({ one }) => ({
  candidate: one(candidates, { fields: [enrichmentQueue.candidateId], references: [candidates.id] }),
  company: one(companies, { fields: [enrichmentQueue.companyId], references: [companies.id] }),
}))

export const emailAccountsRelations = relations(emailAccounts, ({ one, many }) => ({
  company: one(companies, { fields: [emailAccounts.companyId], references: [companies.id] }),
  creator: one(users, { fields: [emailAccounts.createdBy], references: [users.id] }),
  secret: one(emailAccountSecrets, { fields: [emailAccounts.id], references: [emailAccountSecrets.emailAccountId] }),
  emailQueueItems: many(emailQueue),
}))

export const emailAccountSecretsRelations = relations(emailAccountSecrets, ({ one }) => ({
  emailAccount: one(emailAccounts, { fields: [emailAccountSecrets.emailAccountId], references: [emailAccounts.id] }),
}))

export const domainIdentitiesRelations = relations(domainIdentities, ({ one }) => ({
  company: one(companies, { fields: [domainIdentities.companyId], references: [companies.id] }),
}))

export const emailQueueRelations = relations(emailQueue, ({ one }) => ({
  company: one(companies, { fields: [emailQueue.companyId], references: [companies.id] }),
  emailAccount: one(emailAccounts, { fields: [emailQueue.emailAccountId], references: [emailAccounts.id] }),
  campaignSend: one(campaignSends, { fields: [emailQueue.campaignSendId], references: [campaignSends.id] }),
}))

export const emailSuppressionsRelations = relations(emailSuppressions, ({ one }) => ({
  company: one(companies, { fields: [emailSuppressions.companyId], references: [companies.id] }),
}))

export const campaignFollowUpsRelations = relations(campaignFollowUps, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignFollowUps.campaignId], references: [campaigns.id] }),
}))

// Interview Relations
export const interviewsRelations = relations(interviews, ({ one, many }) => ({
  candidate: one(candidates, { fields: [interviews.candidateId], references: [candidates.id] }),
  job: one(jobs, { fields: [interviews.jobId], references: [jobs.id] }),
  company: one(companies, { fields: [interviews.companyId], references: [companies.id] }),
  scheduledByUser: one(users, { fields: [interviews.scheduledBy], references: [users.id] }),
  feedback: many(interviewFeedback),
  timeSlots: many(interviewTimeSlots),
  participants: many(interviewParticipants),
  reminders: many(interviewReminders),
}))

export const interviewFeedbackRelations = relations(interviewFeedback, ({ one }) => ({
  interview: one(interviews, { fields: [interviewFeedback.interviewId], references: [interviews.id] }),
  user: one(users, { fields: [interviewFeedback.userId], references: [users.id] }),
}))

export const interviewTimeSlotsRelations = relations(interviewTimeSlots, ({ one }) => ({
  interview: one(interviews, { fields: [interviewTimeSlots.interviewId], references: [interviews.id] }),
  company: one(companies, { fields: [interviewTimeSlots.companyId], references: [companies.id] }),
  candidate: one(candidates, { fields: [interviewTimeSlots.candidateId], references: [candidates.id] }),
}))

export const interviewParticipantsRelations = relations(interviewParticipants, ({ one }) => ({
  interview: one(interviews, { fields: [interviewParticipants.interviewId], references: [interviews.id] }),
  user: one(users, { fields: [interviewParticipants.userId], references: [users.id] }),
}))

export const interviewRemindersRelations = relations(interviewReminders, ({ one }) => ({
  interview: one(interviews, { fields: [interviewReminders.interviewId], references: [interviews.id] }),
  recipientUser: one(users, { fields: [interviewReminders.recipientUserId], references: [users.id] }),
}))
