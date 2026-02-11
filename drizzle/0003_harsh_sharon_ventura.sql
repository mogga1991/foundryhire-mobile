CREATE TABLE "campaign_follow_ups" (
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
--> statement-breakpoint
CREATE TABLE "campaign_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_user_id" uuid NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"job_alerts" boolean DEFAULT true NOT NULL,
	"interview_reminders" boolean DEFAULT true NOT NULL,
	"marketing_emails" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_preferences_candidate_user_id_unique" UNIQUE("candidate_user_id")
);
--> statement-breakpoint
CREATE TABLE "candidate_reach_outs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"employer_id" uuid NOT NULL,
	"company_id" uuid,
	"message" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "domain_identities" (
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
--> statement-breakpoint
CREATE TABLE "email_account_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_account_id" uuid NOT NULL,
	"encrypted_data" text NOT NULL,
	"encryption_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_account_secrets_email_account_id_unique" UNIQUE("email_account_id")
);
--> statement-breakpoint
CREATE TABLE "email_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"type" text NOT NULL,
	"display_name" text NOT NULL,
	"from_address" text NOT NULL,
	"from_name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"capabilities" jsonb DEFAULT '{"supportsInbound":false,"supportsWebhooks":false,"supportsThreading":false}'::jsonb,
	"is_default" boolean DEFAULT false,
	"last_used_at" timestamp with time zone,
	"error_message" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_queue" (
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
--> statement-breakpoint
CREATE TABLE "email_suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"email" text NOT NULL,
	"reason" text NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrichment_queue" (
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
--> statement-breakpoint
CREATE TABLE "gdpr_audit_log" (
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
--> statement-breakpoint
CREATE TABLE "interview_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"feedback_text" text,
	"recommendation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'interviewer' NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"recipient_type" text NOT NULL,
	"recipient_email" text NOT NULL,
	"recipient_user_id" uuid,
	"reminder_type" text NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_time_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid,
	"company_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"ai_optimality_score" integer,
	"ai_reasoning" text,
	"status" text DEFAULT 'suggested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"job_id" uuid,
	"company_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 30,
	"interview_type" text DEFAULT 'video' NOT NULL,
	"location" text,
	"phone_number" text,
	"zoom_meeting_id" text,
	"zoom_join_url" text,
	"zoom_start_url" text,
	"candidate_portal_token" text,
	"candidate_portal_expires_at" timestamp with time zone,
	"recording_url" text,
	"transcript" text,
	"ai_summary" text,
	"ai_sentiment_score" integer,
	"ai_competency_scores" jsonb,
	"interview_questions" jsonb,
	"passcode" text,
	"recording_status" text DEFAULT 'not_started' NOT NULL,
	"recording_duration" integer,
	"recording_file_size" integer,
	"recording_processed_at" timestamp with time zone,
	"transcript_status" text DEFAULT 'pending' NOT NULL,
	"transcript_processed_at" timestamp with time zone,
	"webhook_last_received_at" timestamp with time zone,
	"webhook_event_type" text,
	"zoom_host_id" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"cancel_reason" text,
	"internal_notes" jsonb,
	"scheduled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interviews_candidate_portal_token_unique" UNIQUE("candidate_portal_token")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
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
--> statement-breakpoint
CREATE TABLE "question_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"question" text NOT NULL,
	"category" varchar(50) NOT NULL,
	"difficulty" varchar(20) NOT NULL,
	"target_competency" varchar(255) NOT NULL,
	"expected_duration" integer NOT NULL,
	"evaluation_criteria" text NOT NULL,
	"sample_answer" text,
	"job_id" uuid,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
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
--> statement-breakpoint
CREATE TABLE "team_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'viewer' NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by" varchar(255) NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
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
--> statement-breakpoint
CREATE TABLE "webhook_events" (
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
--> statement-breakpoint
ALTER TABLE "candidates" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "api_usage" ADD COLUMN "indeed_leads" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "api_usage" ADD COLUMN "github_searches" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "api_usage" ADD COLUMN "csv_imports" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_sends" ADD COLUMN "provider_message_id" text;--> statement-breakpoint
ALTER TABLE "campaign_sends" ADD COLUMN "follow_up_step" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "email_account_id" uuid;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "total_bounced" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "profile_image_url" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "headline" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "about" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "experience" jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "education" jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "certifications" jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "linkedin_scraped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "enrichment_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "gdpr_deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaign_follow_ups" ADD CONSTRAINT "campaign_follow_ups_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_templates" ADD CONSTRAINT "campaign_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_templates" ADD CONSTRAINT "campaign_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_preferences" ADD CONSTRAINT "candidate_preferences_candidate_user_id_candidate_users_id_fk" FOREIGN KEY ("candidate_user_id") REFERENCES "public"."candidate_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_reach_outs" ADD CONSTRAINT "candidate_reach_outs_candidate_id_candidate_users_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_reach_outs" ADD CONSTRAINT "candidate_reach_outs_employer_id_users_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_reach_outs" ADD CONSTRAINT "candidate_reach_outs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_identities" ADD CONSTRAINT "domain_identities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_account_secrets" ADD CONSTRAINT "email_account_secrets_email_account_id_email_accounts_id_fk" FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_email_account_id_email_accounts_id_fk" FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_campaign_send_id_campaign_sends_id_fk" FOREIGN KEY ("campaign_send_id") REFERENCES "public"."campaign_sends"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_suppressions" ADD CONSTRAINT "email_suppressions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_queue" ADD CONSTRAINT "enrichment_queue_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_queue" ADD CONSTRAINT "enrichment_queue_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gdpr_audit_log" ADD CONSTRAINT "gdpr_audit_log_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_feedback" ADD CONSTRAINT "interview_feedback_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_feedback" ADD CONSTRAINT "interview_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_participants" ADD CONSTRAINT "interview_participants_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_participants" ADD CONSTRAINT "interview_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_reminders" ADD CONSTRAINT "interview_reminders_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_reminders" ADD CONSTRAINT "interview_reminders_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_time_slots" ADD CONSTRAINT "interview_time_slots_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_time_slots" ADD CONSTRAINT "interview_time_slots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_time_slots" ADD CONSTRAINT "interview_time_slots_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_scheduled_by_users_id_fk" FOREIGN KEY ("scheduled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_templates" ADD CONSTRAINT "question_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_templates" ADD CONSTRAINT "question_templates_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_follow_ups_campaign_idx" ON "campaign_follow_ups" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_follow_ups_campaign_step_idx" ON "campaign_follow_ups" USING btree ("campaign_id","step_number");--> statement-breakpoint
CREATE INDEX "campaign_templates_company_id_idx" ON "campaign_templates" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "candidate_reach_outs_candidate_idx" ON "candidate_reach_outs" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "candidate_reach_outs_employer_idx" ON "candidate_reach_outs" USING btree ("employer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_users_email_idx" ON "candidate_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "domain_identities_company_id_idx" ON "domain_identities" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "domain_identities_domain_idx" ON "domain_identities" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "email_accounts_company_id_idx" ON "email_accounts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "email_accounts_type_idx" ON "email_accounts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "email_queue_status_idx" ON "email_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_queue_next_attempt_idx" ON "email_queue" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "email_queue_priority_idx" ON "email_queue" USING btree ("priority","next_attempt_at");--> statement-breakpoint
CREATE INDEX "email_queue_campaign_send_idx" ON "email_queue" USING btree ("campaign_send_id");--> statement-breakpoint
CREATE INDEX "email_queue_company_idx" ON "email_queue" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "email_queue_status_next_attempt_priority_idx" ON "email_queue" USING btree ("status","next_attempt_at","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "email_suppressions_company_email_idx" ON "email_suppressions" USING btree ("company_id","email");--> statement-breakpoint
CREATE INDEX "enrichment_queue_candidate_idx" ON "enrichment_queue" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "enrichment_queue_status_idx" ON "enrichment_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "enrichment_queue_next_attempt_idx" ON "enrichment_queue" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "enrichment_queue_priority_idx" ON "enrichment_queue" USING btree ("priority","next_attempt_at");--> statement-breakpoint
CREATE INDEX "gdpr_audit_log_company_id_idx" ON "gdpr_audit_log" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "gdpr_audit_log_action_idx" ON "gdpr_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "gdpr_audit_log_created_at_idx" ON "gdpr_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "interview_feedback_interview_id_idx" ON "interview_feedback" USING btree ("interview_id");--> statement-breakpoint
CREATE INDEX "interview_participants_interview_id_idx" ON "interview_participants" USING btree ("interview_id");--> statement-breakpoint
CREATE INDEX "interview_participants_user_id_idx" ON "interview_participants" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "interview_participants_interview_user_idx" ON "interview_participants" USING btree ("interview_id","user_id");--> statement-breakpoint
CREATE INDEX "interview_reminders_interview_id_idx" ON "interview_reminders" USING btree ("interview_id");--> statement-breakpoint
CREATE INDEX "interview_reminders_scheduled_for_idx" ON "interview_reminders" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "interview_reminders_status_idx" ON "interview_reminders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "interview_time_slots_company_id_idx" ON "interview_time_slots" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "interview_time_slots_candidate_id_idx" ON "interview_time_slots" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "interviews_candidate_id_idx" ON "interviews" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "interviews_company_id_idx" ON "interviews" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "interviews_job_id_idx" ON "interviews" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "interviews_status_idx" ON "interviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "interviews_scheduled_at_idx" ON "interviews" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "interviews_zoom_meeting_id_idx" ON "interviews" USING btree ("zoom_meeting_id");--> statement-breakpoint
CREATE INDEX "interviews_recording_status_idx" ON "interviews" USING btree ("recording_status");--> statement-breakpoint
CREATE INDEX "interviews_company_status_scheduled_idx" ON "interviews" USING btree ("company_id","status","scheduled_at");--> statement-breakpoint
CREATE INDEX "notifications_company_id_idx" ON "notifications" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_read_idx" ON "notifications" USING btree ("read");--> statement-breakpoint
CREATE INDEX "notifications_type_idx" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "question_templates_company_idx" ON "question_templates" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "question_templates_category_idx" ON "question_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "question_templates_job_idx" ON "question_templates" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "saved_searches_company_id_idx" ON "saved_searches" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "saved_searches_user_id_idx" ON "saved_searches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_searches_entity_idx" ON "saved_searches" USING btree ("entity");--> statement-breakpoint
CREATE INDEX "saved_searches_user_entity_idx" ON "saved_searches" USING btree ("user_id","entity");--> statement-breakpoint
CREATE INDEX "team_invitations_company_id_idx" ON "team_invitations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "team_invitations_email_idx" ON "team_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "team_invitations_token_idx" ON "team_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "team_members_company_id_idx" ON "team_members" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "team_members_user_id_idx" ON "team_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "team_members_email_idx" ON "team_members" USING btree ("email");--> statement-breakpoint
CREATE INDEX "team_members_status_idx" ON "team_members" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_company_email_idx" ON "team_members" USING btree ("company_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_id_idx" ON "webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "webhook_events_status_next_retry_idx" ON "webhook_events" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE UNIQUE INDEX "candidates_company_email_idx" ON "candidates" USING btree ("company_id","email") WHERE email IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "candidates_company_linkedin_idx" ON "candidates" USING btree ("company_id","linkedin_url") WHERE linkedin_url IS NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN "stripe_customer_id";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN "stripe_subscription_id";