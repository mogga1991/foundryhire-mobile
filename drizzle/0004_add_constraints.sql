-- Migration 0004: Add data integrity CHECK constraints
-- All constraints use DO $$ blocks for idempotency (skip if already exists)

-- =============================================================================
-- Interview status must be valid
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_interview_status'
  ) THEN
    ALTER TABLE interviews ADD CONSTRAINT chk_interview_status
      CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'));
  END IF;
END $$;

-- =============================================================================
-- Interview duration must be reasonable (15-180 minutes)
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_interview_duration'
  ) THEN
    ALTER TABLE interviews ADD CONSTRAINT chk_interview_duration
      CHECK (duration_minutes IS NULL OR (duration_minutes >= 15 AND duration_minutes <= 180));
  END IF;
END $$;

-- =============================================================================
-- Team member role must be valid
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_team_member_role'
  ) THEN
    ALTER TABLE team_members ADD CONSTRAINT chk_team_member_role
      CHECK (role IN ('owner', 'admin', 'recruiter', 'interviewer', 'viewer'));
  END IF;
END $$;

-- =============================================================================
-- Team member status must be valid
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_team_member_status'
  ) THEN
    ALTER TABLE team_members ADD CONSTRAINT chk_team_member_status
      CHECK (status IN ('active', 'invited', 'deactivated'));
  END IF;
END $$;

-- =============================================================================
-- Notification type must be valid
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_notification_type'
  ) THEN
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
      ));
  END IF;
END $$;

-- =============================================================================
-- AI sentiment score range (0-100)
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_sentiment_score'
  ) THEN
    ALTER TABLE interviews ADD CONSTRAINT chk_sentiment_score
      CHECK (ai_sentiment_score IS NULL OR (ai_sentiment_score >= 0 AND ai_sentiment_score <= 100));
  END IF;
END $$;

-- =============================================================================
-- Candidate email format (basic regex check)
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_candidate_email'
  ) THEN
    ALTER TABLE candidates ADD CONSTRAINT chk_candidate_email
      CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  END IF;
END $$;

-- =============================================================================
-- Feedback rating range (1-10)
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_feedback_rating'
  ) THEN
    ALTER TABLE interview_feedback ADD CONSTRAINT chk_feedback_rating
      CHECK (rating >= 1 AND rating <= 10);
  END IF;
END $$;

-- =============================================================================
-- Campaign status must be valid
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_campaign_status'
  ) THEN
    ALTER TABLE campaigns ADD CONSTRAINT chk_campaign_status
      CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled'));
  END IF;
END $$;

-- =============================================================================
-- Job status must be valid
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_job_status'
  ) THEN
    ALTER TABLE jobs ADD CONSTRAINT chk_job_status
      CHECK (status IN ('draft', 'active', 'paused', 'closed', 'archived'));
  END IF;
END $$;

-- =============================================================================
-- Enrichment queue priority range (1-10)
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_enrichment_priority'
  ) THEN
    ALTER TABLE enrichment_queue ADD CONSTRAINT chk_enrichment_priority
      CHECK (priority >= 1 AND priority <= 10);
  END IF;
END $$;

-- =============================================================================
-- Webhook events status must be valid
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_webhook_event_status'
  ) THEN
    ALTER TABLE webhook_events ADD CONSTRAINT chk_webhook_event_status
      CHECK (status IN ('received', 'processing', 'completed', 'failed', 'dead_letter'));
  END IF;
END $$;

-- =============================================================================
-- Email queue status must be valid
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_email_queue_status'
  ) THEN
    ALTER TABLE email_queue ADD CONSTRAINT chk_email_queue_status
      CHECK (status IN ('pending', 'in_progress', 'sent', 'failed', 'cancelled'));
  END IF;
END $$;
