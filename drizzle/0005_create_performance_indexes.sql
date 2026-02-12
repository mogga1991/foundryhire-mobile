-- =============================================================================
-- Performance Index Migrations
-- =============================================================================
-- These indexes are designed to improve performance for query-heavy routes:
-- - Interview listing with complex filters
-- - Candidate listing with search and sorting
-- - Campaign listing and tracking
-- - Dashboard aggregation queries
-- =============================================================================

-- =============================================================================
-- Interviews Table Indexes
-- =============================================================================

-- Composite index for common interview list filters (companyId + status + scheduledAt)
-- Supports queries like: WHERE company_id = ? AND status IN (?) ORDER BY scheduled_at DESC
CREATE INDEX IF NOT EXISTS idx_interviews_company_status_scheduled
  ON interviews (company_id, status, scheduled_at DESC);

-- Index for interview search by candidate name
-- Supports queries that JOIN interviews with candidates for search
CREATE INDEX IF NOT EXISTS idx_interviews_candidate_scheduled
  ON interviews (candidate_id, scheduled_at DESC);

-- Index for job-specific interview queries
CREATE INDEX IF NOT EXISTS idx_interviews_job_scheduled
  ON interviews (job_id, scheduled_at DESC)
  WHERE job_id IS NOT NULL;

-- Partial index for upcoming interviews only (optimization for dashboard)
CREATE INDEX IF NOT EXISTS idx_interviews_upcoming
  ON interviews (company_id, scheduled_at)
  WHERE status IN ('scheduled', 'confirmed')
  AND scheduled_at IS NOT NULL;

-- Index for recording status queries (for processing pipelines)
CREATE INDEX IF NOT EXISTS idx_interviews_recording_processing
  ON interviews (scheduled_at DESC);

-- =============================================================================
-- Candidates Table Indexes
-- =============================================================================

-- Composite index for candidate listing with filters
-- Supports: WHERE company_id = ? AND job_id = ? AND status = ? ORDER BY ai_score DESC
CREATE INDEX IF NOT EXISTS idx_candidates_company_job_status_score
  ON candidates (company_id, job_id, status, ai_score DESC NULLS LAST);

-- Index for candidate sorting by creation date
CREATE INDEX IF NOT EXISTS idx_candidates_company_created
  ON candidates (company_id, created_at DESC);

-- Index for enrichment queue processing
CREATE INDEX IF NOT EXISTS idx_candidates_enrichment_status
  ON candidates (company_id, enrichment_status, enrichment_score)
  WHERE enrichment_status IN ('pending', 'partial');

-- Partial index for verified candidates only
CREATE INDEX IF NOT EXISTS idx_candidates_verified
  ON candidates (company_id, email_verified, enrichment_score DESC)
  WHERE email_verified = true;

-- Index on status for filtering
CREATE INDEX IF NOT EXISTS idx_candidates_status_company
  ON candidates (status, company_id, created_at DESC);

-- =============================================================================
-- Campaigns Table Indexes
-- =============================================================================

-- Composite index for campaign listing by job
CREATE INDEX IF NOT EXISTS idx_campaigns_job_company_created
  ON campaigns (job_id, company_id, created_at DESC)
  WHERE job_id IS NOT NULL;

-- Index for active/scheduled campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_active
  ON campaigns (company_id, status, scheduled_at)
  WHERE status IN ('scheduled', 'sending');

-- Index for campaign performance tracking
CREATE INDEX IF NOT EXISTS idx_campaigns_status_created
  ON campaigns (status, created_at DESC);

-- =============================================================================
-- Campaign Sends Table Indexes
-- =============================================================================

-- Composite index for campaign send tracking
-- Supports: WHERE campaign_id = ? AND status = ?
CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign_status
  ON campaign_sends (campaign_id, status, sent_at DESC NULLS LAST);

-- Index for candidate-specific campaign tracking
CREATE INDEX IF NOT EXISTS idx_campaign_sends_candidate
  ON campaign_sends (candidate_id, sent_at DESC NULLS LAST);

-- Partial index for pending sends (queue processing)
CREATE INDEX IF NOT EXISTS idx_campaign_sends_pending
  ON campaign_sends (campaign_id, created_at)
  WHERE status = 'pending';

-- Index for tracking events (opens, clicks)
CREATE INDEX IF NOT EXISTS idx_campaign_sends_opened
  ON campaign_sends (campaign_id, opened_at DESC)
  WHERE opened_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_sends_clicked
  ON campaign_sends (campaign_id, clicked_at DESC)
  WHERE clicked_at IS NOT NULL;

-- =============================================================================
-- Candidate Activities Table Indexes
-- =============================================================================

-- Composite index for activity timeline queries
CREATE INDEX IF NOT EXISTS idx_activities_candidate_created
  ON candidate_activities (candidate_id, created_at DESC);

-- Index for company-wide activity feed
CREATE INDEX IF NOT EXISTS idx_activities_company_created
  ON candidate_activities (company_id, created_at DESC);

-- Index for activity type filtering
CREATE INDEX IF NOT EXISTS idx_activities_type_created
  ON candidate_activities (company_id, activity_type, created_at DESC);

-- =============================================================================
-- Jobs Table Indexes
-- =============================================================================

-- Composite index for active job listings
CREATE INDEX IF NOT EXISTS idx_jobs_company_status_published
  ON jobs (company_id, status, published_at DESC NULLS LAST);

-- Partial index for open positions only
CREATE INDEX IF NOT EXISTS idx_jobs_open
  ON jobs (company_id, published_at DESC)
  WHERE status = 'published';

-- =============================================================================
-- Email Queue Table Indexes (for send optimization)
-- =============================================================================

-- Composite index for email queue processing
CREATE INDEX IF NOT EXISTS idx_email_queue_processing
  ON email_queue (status, priority DESC, next_attempt_at)
  WHERE status IN ('pending', 'in_progress');

-- Index for campaign send tracking
CREATE INDEX IF NOT EXISTS idx_email_queue_campaign
  ON email_queue (campaign_send_id, status)
  WHERE campaign_send_id IS NOT NULL;

-- =============================================================================
-- Foreign Key Indexes (if not already covered by other indexes)
-- =============================================================================

-- Ensure all foreign key columns have indexes for JOIN performance
-- Note: Some may already exist from the composite indexes above

CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_by
  ON interviews (scheduled_by);

CREATE INDEX IF NOT EXISTS idx_campaigns_created_by
  ON campaigns (created_by);

CREATE INDEX IF NOT EXISTS idx_candidate_activities_performed_by
  ON candidate_activities (performed_by)
  WHERE performed_by IS NOT NULL;

-- =============================================================================
-- Statistics Update
-- =============================================================================

-- Update table statistics for query planner
-- Run this after creating indexes and periodically for optimal performance
ANALYZE interviews;
ANALYZE candidates;
ANALYZE campaigns;
ANALYZE campaign_sends;
ANALYZE candidate_activities;
ANALYZE jobs;
ANALYZE email_queue;
