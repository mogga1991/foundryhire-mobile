type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ============================================================================
// Common API Types
// ============================================================================

export interface ApiResponse<T> {
  data: T | null
  error: string | null
  status: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface ApiError {
  message: string
  code: string
  details?: string
}

// ============================================================================
// Job Description Generation
// ============================================================================

export interface GenerateJobDescriptionRequest {
  title: string
  department?: string
  location?: string
  employment_type?: string
  experience_level?: string
  salary_min?: number
  salary_max?: number
  salary_currency?: string
  company_name: string
  industry_sector?: string
  key_requirements?: string[]
  preferred_skills?: string[]
  tone?: 'professional' | 'casual' | 'formal'
}

export interface GenerateJobDescriptionResponse {
  description: string
  requirements: string[]
  responsibilities: string[]
  benefits: string[]
  skills_required: string[]
  skills_preferred: string[]
  ai_credits_used: number
}

// ============================================================================
// Candidate Scoring
// ============================================================================

export interface ScoreCandidateRequest {
  candidate_id: string
  job_id: string
  resume_text?: string
  cover_letter?: string
}

export interface ScoreCandidateResponse {
  overall_score: number
  score_breakdown: CandidateScoreBreakdown
  summary: string
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  ai_credits_used: number
}

export interface CandidateScoreBreakdown {
  skills_match: number
  experience_match: number
  education_match: number
  culture_fit: number
  overall_quality: number
}

// ============================================================================
// Resume Analysis
// ============================================================================

export interface AnalyzeResumeRequest {
  resume_text: string
  resume_url?: string
  job_id?: string
}

export interface AnalyzeResumeResponse {
  extracted_data: ExtractedResumeData
  analysis: ResumeAnalysis
  ai_credits_used: number
}

export interface ExtractedResumeData {
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  github_url: string | null
  portfolio_url: string | null
  current_title: string | null
  current_company: string | null
  location: string | null
  experience_years: number | null
  skills: string[]
  education: EducationEntry[]
  work_experience: WorkExperienceEntry[]
}

export interface EducationEntry {
  institution: string
  degree: string
  field_of_study: string | null
  start_date: string | null
  end_date: string | null
  gpa: string | null
}

export interface WorkExperienceEntry {
  company: string
  title: string
  location: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  description: string | null
  highlights: string[]
}

export interface ResumeAnalysis {
  summary: string
  strengths: string[]
  areas_for_improvement: string[]
  career_trajectory: string
  skill_level: 'junior' | 'mid' | 'senior' | 'lead' | 'executive'
}

// ============================================================================
// Email Generation
// ============================================================================

export interface GenerateEmailRequest {
  email_type: EmailType
  candidate_id: string
  job_id?: string
  campaign_id?: string
  tone?: 'professional' | 'casual' | 'friendly' | 'formal'
  custom_instructions?: string
  sender_name?: string
  company_name?: string
}

export type EmailType =
  | 'outreach'
  | 'follow_up'
  | 'interview_invite'
  | 'rejection'
  | 'offer'
  | 'nurture'
  | 're_engagement'

export interface GenerateEmailResponse {
  subject: string
  body: string
  preview_text: string
  suggested_send_time: string | null
  ai_credits_used: number
}

export interface GenerateBulkEmailsRequest {
  email_type: EmailType
  candidate_ids: string[]
  job_id?: string
  campaign_id?: string
  tone?: 'professional' | 'casual' | 'friendly' | 'formal'
  custom_instructions?: string
  sender_name?: string
  company_name?: string
  personalize: boolean
}

export interface GenerateBulkEmailsResponse {
  emails: GeneratedEmail[]
  total_generated: number
  ai_credits_used: number
}

export interface GeneratedEmail {
  candidate_id: string
  subject: string
  body: string
  preview_text: string
}

// ============================================================================
// Candidate Sourcing
// ============================================================================

export interface SourceCandidatesRequest {
  job_id: string
  search_criteria: SourcingCriteria
  max_results?: number
  sources?: SourcingSource[]
}

export interface SourcingCriteria {
  keywords: string[]
  skills_required?: string[]
  skills_preferred?: string[]
  experience_min?: number
  experience_max?: number
  location?: string
  remote_ok?: boolean
  current_titles?: string[]
  previous_companies?: string[]
  education_level?: string
  industries?: string[]
}

export type SourcingSource = 'linkedin' | 'github' | 'stackoverflow' | 'internal'

export interface SourceCandidatesResponse {
  candidates: SourcedCandidate[]
  total_found: number
  sources_searched: SourcingSource[]
  ai_credits_used: number
}

export interface SourcedCandidate {
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  linkedin_url: string | null
  github_url: string | null
  current_title: string | null
  current_company: string | null
  location: string | null
  experience_years: number | null
  skills: string[]
  match_score: number
  match_reasons: string[]
  source: SourcingSource
  profile_url: string | null
}

// ============================================================================
// Dashboard & Analytics
// ============================================================================

export interface DashboardStatsRequest {
  company_id: string
  date_range?: {
    start: string
    end: string
  }
}

export interface DashboardStatsResponse {
  total_jobs: number
  active_jobs: number
  total_candidates: number
  new_candidates_this_week: number
  candidates_by_stage: Record<string, number>
  candidates_by_source: Record<string, number>
  average_ai_score: number
  ai_credits_remaining: number
  campaign_stats: CampaignStats
  hiring_velocity: HiringVelocity
}

export interface CampaignStats {
  total_campaigns: number
  active_campaigns: number
  average_open_rate: number
  average_click_rate: number
  average_reply_rate: number
}

export interface HiringVelocity {
  average_time_to_hire_days: number
  average_time_to_first_response_days: number
  offers_extended: number
  offers_accepted: number
}

// ============================================================================
// Auth & User
// ============================================================================

export interface SignUpRequest {
  email: string
  password: string
  full_name: string
  company_name: string
  industry_sector?: string
  company_size?: string
}

export interface SignInRequest {
  email: string
  password: string
}

export interface ResetPasswordRequest {
  email: string
}

export interface UpdatePasswordRequest {
  password: string
}

export interface UserProfile {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  company_id: string
  company_name: string
  role: string
  subscription_plan: string
  subscription_status: string
}

// ============================================================================
// Webhook Events
// ============================================================================

export interface WebhookEvent {
  id: string
  type: string
  data: Json
  created_at: string
}
