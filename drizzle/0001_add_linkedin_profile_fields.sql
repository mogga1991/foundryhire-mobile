-- Add missing LinkedIn profile fields to candidates table

ALTER TABLE "candidates" ADD COLUMN "profile_image_url" text;
ALTER TABLE "candidates" ADD COLUMN "headline" text;
ALTER TABLE "candidates" ADD COLUMN "about" text;
ALTER TABLE "candidates" ADD COLUMN "experience" jsonb;
ALTER TABLE "candidates" ADD COLUMN "education" jsonb;
ALTER TABLE "candidates" ADD COLUMN "certifications" jsonb;
ALTER TABLE "candidates" ADD COLUMN "linkedin_scraped_at" timestamp with time zone;
ALTER TABLE "candidates" ADD COLUMN "enrichment_status" text DEFAULT 'pending';
