-- Additional indexes for candidate workspace and offer workflows
-- These target the most frequent query patterns in:
-- - /api/candidate/offers
-- - /api/candidate/documents
-- - /api/candidate/onboarding
-- - lib/services/candidate-workspace

CREATE INDEX IF NOT EXISTS idx_candidates_lower_email
  ON candidates (LOWER(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidate_documents_user_created
  ON candidate_documents (candidate_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_candidate_documents_user_interview
  ON candidate_documents (candidate_user_id, interview_id);

CREATE INDEX IF NOT EXISTS idx_candidate_onboarding_user_created
  ON candidate_onboarding_tasks (candidate_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_candidate_onboarding_user_interview
  ON candidate_onboarding_tasks (candidate_user_id, interview_id);

CREATE INDEX IF NOT EXISTS idx_interviews_candidate_stage_expiry
  ON interviews (candidate_id, status, candidate_portal_expires_at);

