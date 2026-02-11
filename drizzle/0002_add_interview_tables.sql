-- Create interview tables
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
	"scheduled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interviews_candidate_portal_token_unique" UNIQUE("candidate_portal_token")
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
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_scheduled_by_users_id_fk" FOREIGN KEY ("scheduled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_feedback" ADD CONSTRAINT "interview_feedback_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_feedback" ADD CONSTRAINT "interview_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_time_slots" ADD CONSTRAINT "interview_time_slots_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_time_slots" ADD CONSTRAINT "interview_time_slots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_time_slots" ADD CONSTRAINT "interview_time_slots_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_participants" ADD CONSTRAINT "interview_participants_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_participants" ADD CONSTRAINT "interview_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_reminders" ADD CONSTRAINT "interview_reminders_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_reminders" ADD CONSTRAINT "interview_reminders_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interviews_candidate_id_idx" ON "interviews" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "interviews_company_id_idx" ON "interviews" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "interviews_job_id_idx" ON "interviews" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "interviews_status_idx" ON "interviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "interviews_scheduled_at_idx" ON "interviews" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "interviews_zoom_meeting_id_idx" ON "interviews" USING btree ("zoom_meeting_id");--> statement-breakpoint
CREATE INDEX "interviews_recording_status_idx" ON "interviews" USING btree ("recording_status");--> statement-breakpoint
CREATE INDEX "interviews_company_status_scheduled_idx" ON "interviews" USING btree ("company_id","status","scheduled_at");--> statement-breakpoint
CREATE INDEX "interview_feedback_interview_id_idx" ON "interview_feedback" USING btree ("interview_id");--> statement-breakpoint
CREATE INDEX "interview_time_slots_company_id_idx" ON "interview_time_slots" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "interview_time_slots_candidate_id_idx" ON "interview_time_slots" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "interview_participants_interview_id_idx" ON "interview_participants" USING btree ("interview_id");--> statement-breakpoint
CREATE INDEX "interview_participants_user_id_idx" ON "interview_participants" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "interview_participants_interview_user_idx" ON "interview_participants" USING btree ("interview_id","user_id");--> statement-breakpoint
CREATE INDEX "interview_reminders_interview_id_idx" ON "interview_reminders" USING btree ("interview_id");--> statement-breakpoint
CREATE INDEX "interview_reminders_scheduled_for_idx" ON "interview_reminders" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "interview_reminders_status_idx" ON "interview_reminders" USING btree ("status");
