-- Migration 0004: Add data integrity CHECK constraints
-- All constraints use DO $$ blocks for idempotency (skip if already exists)

-- =============================================================================
-- Interview status must be valid
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_interview_status'
  ) AND to_regclass('public.interviews') IS NOT NULL THEN
    ALTER TABLE interviews ADD CONSTRAINT chk_interview_status
      CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')) NOT VALID;
  END IF;
END $$;

-- =============================================================================
-- Interview duration must be reasonable (15-180 minutes)
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_interview_duration'
  ) AND to_regclass('public.interviews') IS NOT NULL THEN
    ALTER TABLE interviews ADD CONSTRAINT chk_interview_duration
      CHECK (duration_minutes IS NULL OR (duration_minutes >= 15 AND duration_minutes <= 180)) NOT VALID;
  END IF;
END $$;

-- =============================================================================
-- Team member role must be valid
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_team_member_role'
  ) AND to_regclass('public.team_members') IS NOT NULL THEN
    ALTER TABLE team_members ADD CONSTRAINT chk_team_member_role
      CHECK (role IN ('owner', 'admin', 'recruiter', 'interviewer', 'viewer')) NOT VALID;
  END IF;
END $$;

-- =============================================================================
-- Team member status must be valid
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_team_member_status'
  ) AND to_regclass('public.team_members') IS NOT NULL THEN
    ALTER TABLE team_members ADD CONSTRAINT chk_team_member_status
      CHECK (status IN ('active', 'invited', 'deactivated')) NOT VALID;
  END IF;
END $$;

-- =============================================================================
-- Notification type must be valid
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_notification_type'
  ) AND to_regclass('public.notifications') IS NOT NULL THEN
    ALTER TABLE notifications ADD CONSTRAINT chk_notification_type
      CHECK (type IN (
        'interview_scheduled',
        'interview_completed',
        'candidate_applied',
        'feedback_submitted',
        'ai_analysis_ready',
        'team_invite',
        'mention',
        'system'
      )) NOT VALID;
  END IF;
END $$;

-- =============================================================================
-- AI sentiment score range (0-100)
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_sentiment_score'
  ) AND to_regclass('public.interviews') IS NOT NULL THEN
    ALTER TABLE interviews ADD CONSTRAINT chk_sentiment_score
      CHECK (ai_sentiment_score IS NULL OR (ai_sentiment_score >= 0 AND ai_sentiment_score <= 100)) NOT VALID;
  END IF;
END $$;

-- =============================================================================
-- Candidate email format (basic regex check)
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_candidate_email'
  ) AND to_regclass('public.candidates') IS NOT NULL THEN
    ALTER TABLE candidates ADD CONSTRAINT chk_candidate_email
      CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') NOT VALID;
  END IF;
END $$;

-- =============================================================================
-- Feedback rating range (1-10)
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_feedback_rating'
  ) AND to_regclass('public.interview_feedback') IS NOT NULL THEN
    ALTER TABLE interview_feedback ADD CONSTRAINT chk_feedback_rating
      CHECK (rating >= 1 AND rating <= 10) NOT VALID;
  END IF;
END $$;

-- =============================================================================
-- Campaign status must be valid
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_campaign_status'
  ) AND to_regclass('public.campaigns') IS NOT NULL THEN
    ALTER TABLE campaigns ADD CONSTRAINT chk_campaign_status
      CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')) NOT VALID;
  END IF;
END $$;

-- =============================================================================
-- Job status must be valid
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_job_status'
  ) AND to_regclass('public.jobs') IS NOT NULL THEN
    ALTER TABLE jobs ADD CONSTRAINT chk_job_status
      CHECK (status IN ('draft', 'active', 'paused', 'closed', 'archived')) NOT VALID;
  END IF;
END $$;

-- =============================================================================
-- Enrichment queue priority range (1-10)
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_enrichment_priority'
  ) AND to_regclass('public.enrichment_queue') IS NOT NULL THEN
    ALTER TABLE enrichment_queue ADD CONSTRAINT chk_enrichment_priority
      CHECK (priority >= 1 AND priority <= 10) NOT VALID;
  END IF;
END $$;

-- =============================================================================
-- Webhook events status must be valid
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_webhook_event_status'
  ) AND to_regclass('public.webhook_events') IS NOT NULL THEN
    ALTER TABLE webhook_events ADD CONSTRAINT chk_webhook_event_status
      CHECK (status IN ('received', 'processing', 'completed', 'failed', 'dead_letter')) NOT VALID;
  END IF;
END $$;

-- =============================================================================
-- Email queue status must be valid
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_email_queue_status'
  ) AND to_regclass('public.email_queue') IS NOT NULL THEN
    ALTER TABLE email_queue ADD CONSTRAINT chk_email_queue_status
      CHECK (status IN ('pending', 'in_progress', 'sent', 'failed', 'cancelled')) NOT VALID;
  END IF;
END $$;
