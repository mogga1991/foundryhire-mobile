-- Migration 0003: Add Sprint 2-6 tables and columns
-- Adds all tables/columns introduced between Sprint 2 and Sprint 6
-- Uses IF NOT EXISTS / IF NOT EXISTS for idempotency

-- =============================================================================
-- Enrichment Queue
-- =============================================================================
CREATE TABLE IF NOT EXISTS "enrichment_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "candidate_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "enrichment_type" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "priority" integer DEFAULT 5 NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "last_error" text,
  "last_attempt_at" timestamp with time zone,
  "next_attempt_at" timestamp with time zone,
  "result" jsonb,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "enrichment_queue" DROP CONSTRAINT IF EXISTS "enrichment_queue_candidate_id_candidates_id_fk";
ALTER TABLE "enrichment_queue" ADD CONSTRAINT "enrichment_queue_candidate_id_candidates_id_fk"
  FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "enrichment_queue" DROP CONSTRAINT IF EXISTS "enrichment_queue_company_id_companies_id_fk";
ALTER TABLE "enrichment_queue" ADD CONSTRAINT "enrichment_queue_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "enrichment_queue_candidate_idx" ON "enrichment_queue" USING btree ("candidate_id");
CREATE INDEX IF NOT EXISTS "enrichment_queue_status_idx" ON "enrichment_queue" USING btree ("status");
CREATE INDEX IF NOT EXISTS "enrichment_queue_next_attempt_idx" ON "enrichment_queue" USING btree ("next_attempt_at");
CREATE INDEX IF NOT EXISTS "enrichment_queue_priority_idx" ON "enrichment_queue" USING btree ("priority", "next_attempt_at");

-- =============================================================================
-- Email Accounts
-- =============================================================================
CREATE TABLE IF NOT EXISTS "email_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "type" text NOT NULL,
  "display_name" text NOT NULL,
  "from_address" text NOT NULL,
  "from_name" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "capabilities" jsonb DEFAULT '{"supportsInbound": false, "supportsWebhooks": false, "supportsThreading": false}',
  "is_default" boolean DEFAULT false,
  "last_used_at" timestamp with time zone,
  "error_message" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "email_accounts" DROP CONSTRAINT IF EXISTS "email_accounts_company_id_companies_id_fk";
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "email_accounts" DROP CONSTRAINT IF EXISTS "email_accounts_created_by_users_id_fk";
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "email_accounts_company_id_idx" ON "email_accounts" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "email_accounts_type_idx" ON "email_accounts" USING btree ("type");

-- =============================================================================
-- Email Account Secrets
-- =============================================================================
CREATE TABLE IF NOT EXISTS "email_account_secrets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email_account_id" uuid NOT NULL UNIQUE,
  "encrypted_data" text NOT NULL,
  "encryption_version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "email_account_secrets" DROP CONSTRAINT IF EXISTS "email_account_secrets_email_account_id_email_accounts_id_fk";
ALTER TABLE "email_account_secrets" ADD CONSTRAINT "email_account_secrets_email_account_id_email_accounts_id_fk"
  FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;

-- =============================================================================
-- Domain Identities
-- =============================================================================
CREATE TABLE IF NOT EXISTS "domain_identities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "domain" text NOT NULL,
  "resend_domain_id" text,
  "dkim_status" text DEFAULT 'pending' NOT NULL,
  "spf_status" text DEFAULT 'pending' NOT NULL,
  "dkim_records" jsonb,
  "spf_record" text,
  "verified_at" timestamp with time zone,
  "tracking_domain" text,
  "last_checked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "domain_identities" DROP CONSTRAINT IF EXISTS "domain_identities_company_id_companies_id_fk";
ALTER TABLE "domain_identities" ADD CONSTRAINT "domain_identities_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "domain_identities_company_id_idx" ON "domain_identities" USING btree ("company_id");
CREATE UNIQUE INDEX IF NOT EXISTS "domain_identities_domain_idx" ON "domain_identities" USING btree ("domain");

-- =============================================================================
-- Email Queue
-- =============================================================================
CREATE TABLE IF NOT EXISTS "email_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "email_account_id" uuid,
  "campaign_send_id" uuid,
  "from_address" text NOT NULL,
  "from_name" text,
  "to_address" text NOT NULL,
  "subject" text NOT NULL,
  "html_body" text NOT NULL,
  "text_body" text,
  "reply_to" text,
  "headers" jsonb,
  "status" text DEFAULT 'pending' NOT NULL,
  "priority" integer DEFAULT 5 NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "last_error" text,
  "last_attempt_at" timestamp with time zone,
  "next_attempt_at" timestamp with time zone DEFAULT now(),
  "provider_message_id" text,
  "sent_at" timestamp with time zone,
  "scheduled_for" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "email_queue" DROP CONSTRAINT IF EXISTS "email_queue_company_id_companies_id_fk";
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "email_queue" DROP CONSTRAINT IF EXISTS "email_queue_email_account_id_email_accounts_id_fk";
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_email_account_id_email_accounts_id_fk"
  FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "email_queue" DROP CONSTRAINT IF EXISTS "email_queue_campaign_send_id_campaign_sends_id_fk";
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_campaign_send_id_campaign_sends_id_fk"
  FOREIGN KEY ("campaign_send_id") REFERENCES "public"."campaign_sends"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "email_queue_status_idx" ON "email_queue" USING btree ("status");
CREATE INDEX IF NOT EXISTS "email_queue_next_attempt_idx" ON "email_queue" USING btree ("next_attempt_at");
CREATE INDEX IF NOT EXISTS "email_queue_priority_idx" ON "email_queue" USING btree ("priority", "next_attempt_at");
CREATE INDEX IF NOT EXISTS "email_queue_campaign_send_idx" ON "email_queue" USING btree ("campaign_send_id");
CREATE INDEX IF NOT EXISTS "email_queue_company_idx" ON "email_queue" USING btree ("company_id");

-- =============================================================================
-- Email Suppressions
-- =============================================================================
CREATE TABLE IF NOT EXISTS "email_suppressions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "email" text NOT NULL,
  "reason" text NOT NULL,
  "source" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "email_suppressions" DROP CONSTRAINT IF EXISTS "email_suppressions_company_id_companies_id_fk";
ALTER TABLE "email_suppressions" ADD CONSTRAINT "email_suppressions_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "email_suppressions_company_email_idx" ON "email_suppressions" USING btree ("company_id", "email");

-- =============================================================================
-- Candidate Users (Candidate Portal accounts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "candidate_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "email_verified" boolean DEFAULT false,
  "verification_token" text,
  "verification_token_expiry" timestamp with time zone,
  "reset_password_token" text,
  "reset_password_expiry" timestamp with time zone,
  "profile_image_url" text,
  "phone" text,
  "location" text,
  "current_title" text,
  "current_company" text,
  "linkedin_url" text,
  "resume_url" text,
  "bio" text,
  "skills" text[],
  "experience_years" integer,
  "last_login_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "candidate_users_email_idx" ON "candidate_users" USING btree ("email");

-- =============================================================================
-- Candidate Reach-Outs
-- =============================================================================
CREATE TABLE IF NOT EXISTS "candidate_reach_outs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "candidate_id" uuid NOT NULL,
  "employer_id" uuid NOT NULL,
  "company_id" uuid,
  "message" text NOT NULL,
  "status" text DEFAULT 'sent' NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "candidate_reach_outs" DROP CONSTRAINT IF EXISTS "candidate_reach_outs_candidate_id_candidate_users_id_fk";
ALTER TABLE "candidate_reach_outs" ADD CONSTRAINT "candidate_reach_outs_candidate_id_candidate_users_id_fk"
  FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate_users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "candidate_reach_outs" DROP CONSTRAINT IF EXISTS "candidate_reach_outs_employer_id_users_id_fk";
ALTER TABLE "candidate_reach_outs" ADD CONSTRAINT "candidate_reach_outs_employer_id_users_id_fk"
  FOREIGN KEY ("employer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "candidate_reach_outs" DROP CONSTRAINT IF EXISTS "candidate_reach_outs_company_id_companies_id_fk";
ALTER TABLE "candidate_reach_outs" ADD CONSTRAINT "candidate_reach_outs_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "candidate_reach_outs_candidate_idx" ON "candidate_reach_outs" USING btree ("candidate_id");
CREATE INDEX IF NOT EXISTS "candidate_reach_outs_employer_idx" ON "candidate_reach_outs" USING btree ("employer_id");

-- =============================================================================
-- Campaign Follow-Ups
-- =============================================================================
CREATE TABLE IF NOT EXISTS "campaign_follow_ups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL,
  "step_number" integer NOT NULL,
  "delay_days" integer NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "campaign_follow_ups" DROP CONSTRAINT IF EXISTS "campaign_follow_ups_campaign_id_campaigns_id_fk";
ALTER TABLE "campaign_follow_ups" ADD CONSTRAINT "campaign_follow_ups_campaign_id_campaigns_id_fk"
  FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "campaign_follow_ups_campaign_idx" ON "campaign_follow_ups" USING btree ("campaign_id");
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_follow_ups_campaign_step_idx" ON "campaign_follow_ups" USING btree ("campaign_id", "step_number");

-- =============================================================================
-- Webhook Events
-- =============================================================================
CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id" text PRIMARY KEY NOT NULL,
  "provider" text NOT NULL,
  "event_type" text NOT NULL,
  "event_id" text NOT NULL,
  "meeting_id" text,
  "payload" jsonb,
  "status" text DEFAULT 'received' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "last_attempt_at" timestamp with time zone,
  "next_retry_at" timestamp with time zone,
  "error_message" text,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_provider_event_id_idx" ON "webhook_events" USING btree ("provider", "event_id");
CREATE INDEX IF NOT EXISTS "webhook_events_status_next_retry_idx" ON "webhook_events" USING btree ("status", "next_retry_at");

-- =============================================================================
-- Team Members
-- =============================================================================
CREATE TABLE IF NOT EXISTS "team_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "user_id" varchar(255),
  "email" varchar(255) NOT NULL,
  "first_name" varchar(100),
  "last_name" varchar(100),
  "role" varchar(50) DEFAULT 'viewer' NOT NULL,
  "status" varchar(50) DEFAULT 'invited' NOT NULL,
  "invited_by" varchar(255),
  "invited_at" timestamp with time zone DEFAULT now(),
  "joined_at" timestamp with time zone,
  "last_active_at" timestamp with time zone,
  "permissions" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "team_members" DROP CONSTRAINT IF EXISTS "team_members_company_id_companies_id_fk";
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "team_members_company_id_idx" ON "team_members" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "team_members_user_id_idx" ON "team_members" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "team_members_email_idx" ON "team_members" USING btree ("email");
CREATE INDEX IF NOT EXISTS "team_members_status_idx" ON "team_members" USING btree ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "team_members_company_email_idx" ON "team_members" USING btree ("company_id", "email");

-- =============================================================================
-- Team Invitations
-- =============================================================================
CREATE TABLE IF NOT EXISTS "team_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "email" varchar(255) NOT NULL,
  "role" varchar(50) DEFAULT 'viewer' NOT NULL,
  "token" varchar(255) NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "invited_by" varchar(255) NOT NULL,
  "accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "team_invitations" DROP CONSTRAINT IF EXISTS "team_invitations_company_id_companies_id_fk";
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "team_invitations_company_id_idx" ON "team_invitations" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "team_invitations_email_idx" ON "team_invitations" USING btree ("email");
CREATE INDEX IF NOT EXISTS "team_invitations_token_idx" ON "team_invitations" USING btree ("token");

-- =============================================================================
-- Notifications
-- =============================================================================
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "type" varchar(50) NOT NULL,
  "title" varchar(255) NOT NULL,
  "message" text NOT NULL,
  "action_url" varchar(500),
  "metadata" jsonb,
  "read" boolean DEFAULT false NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_company_id_companies_id_fk";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "notifications_company_id_idx" ON "notifications" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "notifications_read_idx" ON "notifications" USING btree ("read");
CREATE INDEX IF NOT EXISTS "notifications_type_idx" ON "notifications" USING btree ("type");
CREATE INDEX IF NOT EXISTS "notifications_user_read_idx" ON "notifications" USING btree ("user_id", "read");
CREATE INDEX IF NOT EXISTS "notifications_created_at_idx" ON "notifications" USING btree ("created_at");

-- =============================================================================
-- GDPR Audit Log
-- =============================================================================
CREATE TABLE IF NOT EXISTS "gdpr_audit_log" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" text NOT NULL,
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text,
  "requested_by" text NOT NULL,
  "details" jsonb,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "gdpr_audit_log" DROP CONSTRAINT IF EXISTS "gdpr_audit_log_company_id_companies_id_fk";
ALTER TABLE "gdpr_audit_log" ADD CONSTRAINT "gdpr_audit_log_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "gdpr_audit_log_company_id_idx" ON "gdpr_audit_log" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "gdpr_audit_log_action_idx" ON "gdpr_audit_log" USING btree ("action");
CREATE INDEX IF NOT EXISTS "gdpr_audit_log_created_at_idx" ON "gdpr_audit_log" USING btree ("created_at");

-- =============================================================================
-- Saved Searches
-- =============================================================================
CREATE TABLE IF NOT EXISTS "saved_searches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "name" varchar(100) NOT NULL,
  "entity" varchar(50) NOT NULL,
  "filters" jsonb NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "saved_searches" DROP CONSTRAINT IF EXISTS "saved_searches_company_id_companies_id_fk";
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "saved_searches_company_id_idx" ON "saved_searches" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "saved_searches_user_id_idx" ON "saved_searches" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "saved_searches_entity_idx" ON "saved_searches" USING btree ("entity");
CREATE INDEX IF NOT EXISTS "saved_searches_user_entity_idx" ON "saved_searches" USING btree ("user_id", "entity");

-- =============================================================================
-- ALTER existing tables: Add missing columns
-- =============================================================================

-- Campaigns: add email_account_id and total_bounced
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "email_account_id" uuid;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "total_bounced" integer DEFAULT 0 NOT NULL;

-- Campaign sends: add provider_message_id and follow_up_step
ALTER TABLE "campaign_sends" ADD COLUMN IF NOT EXISTS "provider_message_id" text;
ALTER TABLE "campaign_sends" ADD COLUMN IF NOT EXISTS "follow_up_step" integer DEFAULT 0 NOT NULL;

-- Candidates: add gdpr_deleted_at
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "gdpr_deleted_at" timestamp with time zone;

-- Candidates: make email nullable (originally was NOT NULL, schema now allows null)
-- This is needed because some candidates are imported without email
ALTER TABLE "candidates" ALTER COLUMN "email" DROP NOT NULL;

-- Candidates: add unique indexes for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS "candidates_company_email_idx"
  ON "candidates" ("company_id", "email")
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "candidates_company_linkedin_idx"
  ON "candidates" ("company_id", "linkedin_url")
  WHERE linkedin_url IS NOT NULL;

-- Interviews: add internal_notes column (jsonb)
ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "internal_notes" jsonb;

-- API Usage: add missing columns from later sprints
ALTER TABLE "api_usage" ADD COLUMN IF NOT EXISTS "indeed_leads" integer DEFAULT 0 NOT NULL;
ALTER TABLE "api_usage" ADD COLUMN IF NOT EXISTS "github_searches" integer DEFAULT 0 NOT NULL;
ALTER TABLE "api_usage" ADD COLUMN IF NOT EXISTS "csv_imports" integer DEFAULT 0 NOT NULL;
