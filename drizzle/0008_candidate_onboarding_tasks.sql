CREATE TABLE IF NOT EXISTS "candidate_onboarding_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "candidate_user_id" uuid NOT NULL,
  "company_id" uuid,
  "candidate_record_id" uuid,
  "interview_id" uuid,
  "title" text NOT NULL,
  "description" text,
  "task_type" text DEFAULT 'form' NOT NULL,
  "required" boolean DEFAULT true NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "document_type" text,
  "due_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "candidate_onboarding_tasks" ADD COLUMN IF NOT EXISTS "candidate_user_id" uuid;
ALTER TABLE "candidate_onboarding_tasks" ADD COLUMN IF NOT EXISTS "company_id" uuid;
ALTER TABLE "candidate_onboarding_tasks" ADD COLUMN IF NOT EXISTS "candidate_record_id" uuid;
ALTER TABLE "candidate_onboarding_tasks" ADD COLUMN IF NOT EXISTS "interview_id" uuid;
ALTER TABLE "candidate_onboarding_tasks" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "candidate_onboarding_tasks" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "candidate_onboarding_tasks" ADD COLUMN IF NOT EXISTS "task_type" text DEFAULT 'form' NOT NULL;
ALTER TABLE "candidate_onboarding_tasks" ADD COLUMN IF NOT EXISTS "required" boolean DEFAULT true NOT NULL;
ALTER TABLE "candidate_onboarding_tasks" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
ALTER TABLE "candidate_onboarding_tasks" ADD COLUMN IF NOT EXISTS "document_type" text;
ALTER TABLE "candidate_onboarding_tasks" ADD COLUMN IF NOT EXISTS "due_at" timestamp with time zone;
ALTER TABLE "candidate_onboarding_tasks" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
ALTER TABLE "candidate_onboarding_tasks" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
ALTER TABLE "candidate_onboarding_tasks" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "candidate_onboarding_tasks" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

ALTER TABLE "candidate_onboarding_tasks" DROP CONSTRAINT IF EXISTS "candidate_onboarding_tasks_candidate_user_id_candidate_users_id_fk";
ALTER TABLE "candidate_onboarding_tasks" ADD CONSTRAINT "candidate_onboarding_tasks_candidate_user_id_candidate_users_id_fk"
  FOREIGN KEY ("candidate_user_id") REFERENCES "public"."candidate_users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "candidate_onboarding_tasks" DROP CONSTRAINT IF EXISTS "candidate_onboarding_tasks_company_id_companies_id_fk";
ALTER TABLE "candidate_onboarding_tasks" ADD CONSTRAINT "candidate_onboarding_tasks_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "candidate_onboarding_tasks" DROP CONSTRAINT IF EXISTS "candidate_onboarding_tasks_candidate_record_id_candidates_id_fk";
ALTER TABLE "candidate_onboarding_tasks" ADD CONSTRAINT "candidate_onboarding_tasks_candidate_record_id_candidates_id_fk"
  FOREIGN KEY ("candidate_record_id") REFERENCES "public"."candidates"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "candidate_onboarding_tasks_candidate_user_idx" ON "candidate_onboarding_tasks" ("candidate_user_id");
CREATE INDEX IF NOT EXISTS "candidate_onboarding_tasks_status_idx" ON "candidate_onboarding_tasks" ("status");
CREATE INDEX IF NOT EXISTS "candidate_onboarding_tasks_due_at_idx" ON "candidate_onboarding_tasks" ("due_at");
