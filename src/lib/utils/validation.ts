import { z } from 'zod'

/**
 * Shared Zod validation schemas for VerticalHire
 */

// ============================================================================
// Job Schema
// ============================================================================

export const jobSchema = z.object({
  title: z
    .string()
    .min(3, 'Job title must be at least 3 characters')
    .max(200, 'Job title must be under 200 characters'),
  department: z.string().max(100).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  employment_type: z
    .enum(['full_time', 'part_time', 'contract', 'temporary', 'internship'])
    .optional()
    .nullable(),
  experience_level: z
    .enum(['entry', 'mid', 'senior', 'lead', 'executive'])
    .optional()
    .nullable(),
  salary_min: z
    .number()
    .min(0, 'Salary must be positive')
    .optional()
    .nullable(),
  salary_max: z
    .number()
    .min(0, 'Salary must be positive')
    .optional()
    .nullable(),
  salary_currency: z.string().length(3).default('USD').optional().nullable(),
  description: z
    .string()
    .max(10000, 'Description must be under 10,000 characters')
    .optional()
    .nullable(),
  requirements: z.array(z.string()).optional().nullable(),
  responsibilities: z.array(z.string()).optional().nullable(),
  benefits: z.array(z.string()).optional().nullable(),
  skills_required: z.array(z.string()).optional().nullable(),
  skills_preferred: z.array(z.string()).optional().nullable(),
  status: z.enum(['draft', 'active', 'paused', 'closed']).default('draft'),
  closes_at: z.string().optional().nullable(),
})

export type JobFormValues = z.infer<typeof jobSchema>

// ============================================================================
// Candidate Schema
// ============================================================================

export const candidateSchema = z.object({
  first_name: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be under 100 characters'),
  last_name: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be under 100 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z
    .string()
    .max(30, 'Phone number must be under 30 characters')
    .optional()
    .nullable(),
  linkedin_url: z
    .string()
    .url('Please enter a valid URL')
    .optional()
    .nullable()
    .or(z.literal('')),
  github_url: z
    .string()
    .url('Please enter a valid URL')
    .optional()
    .nullable()
    .or(z.literal('')),
  portfolio_url: z
    .string()
    .url('Please enter a valid URL')
    .optional()
    .nullable()
    .or(z.literal('')),
  current_title: z.string().max(200).optional().nullable(),
  current_company: z.string().max(200).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  experience_years: z
    .number()
    .min(0)
    .max(60, 'Experience must be under 60 years')
    .optional()
    .nullable(),
  skills: z.array(z.string()).optional().nullable(),
  source: z
    .enum(['manual', 'linkedin', 'referral', 'website', 'job_board', 'ai_sourced'])
    .default('manual'),
  notes: z.string().max(5000).optional().nullable(),
  job_id: z.string().uuid().optional().nullable(),
})

export type CandidateFormValues = z.infer<typeof candidateSchema>

// ============================================================================
// Campaign Schema
// ============================================================================

export const campaignSchema = z.object({
  name: z
    .string()
    .min(1, 'Campaign name is required')
    .max(200, 'Campaign name must be under 200 characters'),
  subject: z
    .string()
    .min(1, 'Email subject is required')
    .max(300, 'Subject must be under 300 characters'),
  body: z
    .string()
    .min(1, 'Email body is required')
    .max(20000, 'Body must be under 20,000 characters'),
  campaign_type: z.enum(['outreach', 'follow_up', 'nurture', 'event']).default('outreach'),
  scheduled_at: z.string().optional().nullable(),
  job_id: z.string().uuid().optional().nullable(),
})

export type CampaignFormValues = z.infer<typeof campaignSchema>

// ============================================================================
// Company Schema
// ============================================================================

export const companySchema = z.object({
  name: z
    .string()
    .min(2, 'Company name must be at least 2 characters')
    .max(200, 'Company name must be under 200 characters'),
  industry_sector: z
    .string()
    .max(200, 'Industry sector must be under 200 characters')
    .optional()
    .nullable(),
  company_size: z
    .enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'])
    .optional()
    .nullable(),
  website: z
    .string()
    .url('Please enter a valid URL')
    .optional()
    .nullable()
    .or(z.literal('')),
})

export type CompanyFormValues = z.infer<typeof companySchema>

// ============================================================================
// Invite Team Member Schema
// ============================================================================

export const inviteTeamMemberSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['admin', 'recruiter', 'viewer']),
})

export type InviteTeamMemberFormValues = z.infer<typeof inviteTeamMemberSchema>
