import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import type {
  companies,
  companyUsers,
  subscriptions,
  jobs,
  candidates,
  campaigns,
  campaignSends,
  candidateActivities,
  candidateReminders,
  emailAccounts,
  emailAccountSecrets,
  domainIdentities,
  emailQueue,
  emailSuppressions,
  campaignFollowUps,
  campaignTemplates,
} from '@/lib/db/schema'

// Company types
export type Company = InferSelectModel<typeof companies>
export type CompanyInsert = InferInsertModel<typeof companies>
export type CompanyUpdate = Partial<InferInsertModel<typeof companies>>

// Company User types
export type CompanyUser = InferSelectModel<typeof companyUsers>
export type CompanyUserInsert = InferInsertModel<typeof companyUsers>
export type CompanyUserUpdate = Partial<InferInsertModel<typeof companyUsers>>

// Subscription types
export type Subscription = InferSelectModel<typeof subscriptions>
export type SubscriptionInsert = InferInsertModel<typeof subscriptions>
export type SubscriptionUpdate = Partial<InferInsertModel<typeof subscriptions>>

// Job types
export type Job = InferSelectModel<typeof jobs>
export type JobInsert = InferInsertModel<typeof jobs>
export type JobUpdate = Partial<InferInsertModel<typeof jobs>>

// Candidate types
export type Candidate = InferSelectModel<typeof candidates>
export type CandidateInsert = InferInsertModel<typeof candidates>
export type CandidateUpdate = Partial<InferInsertModel<typeof candidates>>

// Campaign types
export type Campaign = InferSelectModel<typeof campaigns>
export type CampaignInsert = InferInsertModel<typeof campaigns>
export type CampaignUpdate = Partial<InferInsertModel<typeof campaigns>>

// Campaign Send types
export type CampaignSend = InferSelectModel<typeof campaignSends>
export type CampaignSendInsert = InferInsertModel<typeof campaignSends>
export type CampaignSendUpdate = Partial<InferInsertModel<typeof campaignSends>>

// Candidate Activity types
export type CandidateActivity = InferSelectModel<typeof candidateActivities>
export type CandidateActivityInsert = InferInsertModel<typeof candidateActivities>
export type CandidateActivityUpdate = Partial<InferInsertModel<typeof candidateActivities>>

// Candidate Reminder types
export type CandidateReminder = InferSelectModel<typeof candidateReminders>
export type CandidateReminderInsert = InferInsertModel<typeof candidateReminders>
export type CandidateReminderUpdate = Partial<InferInsertModel<typeof candidateReminders>>

// Email Account types
export type EmailAccount = InferSelectModel<typeof emailAccounts>
export type EmailAccountInsert = InferInsertModel<typeof emailAccounts>

// Email Account Secrets types
export type EmailAccountSecret = InferSelectModel<typeof emailAccountSecrets>

// Domain Identity types
export type DomainIdentity = InferSelectModel<typeof domainIdentities>
export type DomainIdentityInsert = InferInsertModel<typeof domainIdentities>

// Email Queue types
export type EmailQueueItem = InferSelectModel<typeof emailQueue>
export type EmailQueueItemInsert = InferInsertModel<typeof emailQueue>

// Email Suppression types
export type EmailSuppression = InferSelectModel<typeof emailSuppressions>

// Campaign Follow-Up types
export type CampaignFollowUp = InferSelectModel<typeof campaignFollowUps>
export type CampaignFollowUpInsert = InferInsertModel<typeof campaignFollowUps>

// Campaign Template types
export type CampaignTemplate = InferSelectModel<typeof campaignTemplates>
export type CampaignTemplateInsert = InferInsertModel<typeof campaignTemplates>
