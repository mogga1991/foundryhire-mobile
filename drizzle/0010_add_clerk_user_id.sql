-- Add Clerk user mapping to local users table
-- Clerk user IDs are string identifiers (e.g. "user_..."), so we store them separately

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "clerk_user_id" text;

-- Unique mapping when present (multiple NULLs are allowed)
CREATE UNIQUE INDEX IF NOT EXISTS "users_clerk_user_id_unique"
  ON "users" ("clerk_user_id")
  WHERE "clerk_user_id" IS NOT NULL;

