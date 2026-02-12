CREATE TABLE IF NOT EXISTS "candidate_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "candidate_user_id" uuid NOT NULL,
  "company_id" uuid,
  "candidate_record_id" uuid,
  "interview_id" uuid,
  "document_type" text NOT NULL,
  "file_name" text NOT NULL,
  "file_url" text NOT NULL,
  "file_mime_type" text,
  "file_size_bytes" integer,
  "required" boolean DEFAULT false NOT NULL,
  "status" text DEFAULT 'uploaded' NOT NULL,
  "score" integer,
  "insights" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "candidate_documents" ADD COLUMN IF NOT EXISTS "candidate_user_id" uuid;
ALTER TABLE "candidate_documents" ADD COLUMN IF NOT EXISTS "company_id" uuid;
ALTER TABLE "candidate_documents" ADD COLUMN IF NOT EXISTS "candidate_record_id" uuid;
ALTER TABLE "candidate_documents" ADD COLUMN IF NOT EXISTS "interview_id" uuid;
ALTER TABLE "candidate_documents" ADD COLUMN IF NOT EXISTS "document_type" text;
ALTER TABLE "candidate_documents" ADD COLUMN IF NOT EXISTS "file_name" text;
ALTER TABLE "candidate_documents" ADD COLUMN IF NOT EXISTS "file_url" text;
ALTER TABLE "candidate_documents" ADD COLUMN IF NOT EXISTS "file_mime_type" text;
ALTER TABLE "candidate_documents" ADD COLUMN IF NOT EXISTS "file_size_bytes" integer;
ALTER TABLE "candidate_documents" ADD COLUMN IF NOT EXISTS "required" boolean DEFAULT false NOT NULL;
ALTER TABLE "candidate_documents" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'uploaded' NOT NULL;
ALTER TABLE "candidate_documents" ADD COLUMN IF NOT EXISTS "score" integer;
ALTER TABLE "candidate_documents" ADD COLUMN IF NOT EXISTS "insights" jsonb;
ALTER TABLE "candidate_documents" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "candidate_documents" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

ALTER TABLE "candidate_documents" DROP CONSTRAINT IF EXISTS "candidate_documents_candidate_user_id_candidate_users_id_fk";
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_candidate_user_id_candidate_users_id_fk"
  FOREIGN KEY ("candidate_user_id") REFERENCES "public"."candidate_users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "candidate_documents" DROP CONSTRAINT IF EXISTS "candidate_documents_company_id_companies_id_fk";
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "candidate_documents" DROP CONSTRAINT IF EXISTS "candidate_documents_candidate_record_id_candidates_id_fk";
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_candidate_record_id_candidates_id_fk"
  FOREIGN KEY ("candidate_record_id") REFERENCES "public"."candidates"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "candidate_documents_candidate_user_idx" ON "candidate_documents" ("candidate_user_id");
CREATE INDEX IF NOT EXISTS "candidate_documents_company_idx" ON "candidate_documents" ("company_id");
CREATE INDEX IF NOT EXISTS "candidate_documents_document_type_idx" ON "candidate_documents" ("document_type");
